'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const { extractMeasurements } = require('./lib/extract');

const API_BASE = 'https://airapi.airly.eu/v2';

class Airly extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'airly' });

        this.pollTimer = null;

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        const apikey = (this.config.apikey || '').trim();

        if (!apikey) {
            this.log.error('Airly API key is not configured. Open the adapter settings and enter it.');
            return;
        }
        const { lat, lng } = this.coords();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            this.log.error('Latitude / longitude are not configured correctly.');
            return;
        }

        this.mode = this.config.mode === 'nearest' ? 'nearest' : 'point';
        this.maxDistanceKM = parseFloat(this.config.maxDistanceKM) || 25;
        // Enforce a hard minimum of 5 minutes in code too (the jsonConfig min is frontend-only),
        // so a value entered via CLI / object edit cannot exhaust Airly's daily quota.
        const pollMinutes = Math.max(5, parseInt(this.config.pollInterval, 10) || 20);

        this.http = axios.create({
            baseURL: API_BASE,
            timeout: 15000,
            headers: {
                Accept: 'application/json',
                apikey: apikey,
            },
        });

        await this.setStateChangedAsync('info.connection', {
            val: false,
            ack: true,
        });

        // info.installationId is obsolete since v0.2.0 (point/nearest need no station id).
        this.delObjectAsync('info.installationId').catch(() => {});

        // Run immediately, then on the configured interval (setInterval is cleared on unload).
        await this.poll();
        this.pollTimer = this.setInterval(() => this.poll(), pollMinutes * 60 * 1000);
    }

    /**
     * Read the configured coordinates fresh from the (live) adapter config on every call,
     * so a poll never sends a stale/invalid value.
     *
     * @returns {{ lat: number, lng: number }} parsed latitude/longitude (NaN if unset/invalid)
     */
    coords() {
        return {
            lat: parseFloat(this.config.latitude),
            lng: parseFloat(this.config.longitude),
        };
    }

    /**
     * One measurement cycle: fetch measurements for the configured point and write states.
     *
     * Airly's point/nearest measurement endpoints take lat/lng directly, so there is no
     * separate "find installation" call and no installationId to cache.
     */
    async poll() {
        const { lat, lng } = this.coords();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            this.log.warn(
                `Skipping poll: coordinates are not valid numbers ` +
                    `(latitude=${JSON.stringify(this.config.latitude)}, longitude=${JSON.stringify(this.config.longitude)}). ` +
                    `Check the instance settings.`,
            );
            await this.setStateChangedAsync('info.connection', { val: false, ack: true });
            return;
        }

        try {
            const endpoint = this.mode === 'nearest' ? '/measurements/nearest' : '/measurements/point';
            const params = { lat, lng };
            if (this.mode === 'nearest') {
                params.maxDistanceKM = this.maxDistanceKM;
            }

            const res = await this.http.get(endpoint, { params });
            this.logQuota(res.headers);

            await this.writeMeasurements(res.data);
            await this.setStateChangedAsync('info.connection', {
                val: true,
                ack: true,
            });
        } catch (err) {
            this.handleError(err);
            await this.setStateChangedAsync('info.connection', {
                val: false,
                ack: true,
            });
        }
    }

    /**
     * Map the Airly measurements payload onto adapter states.
     *
     * @param payload raw Airly measurements response
     */
    async writeMeasurements(payload) {
        const states = extractMeasurements(payload);
        if (!states) {
            this.log.warn('Airly response contained no "current" measurements (point out of coverage?).');
            return;
        }

        await Promise.all(
            Object.entries(states)
                .filter(([, val]) => val !== null)
                .map(([id, val]) => this.setStateChangedAsync(id, { val, ack: true })),
        );
    }

    /**
     * Log how much of the daily quota is left, read from Airly's rate-limit headers.
     *
     * @param headers axios response headers from the last Airly request
     */
    logQuota(headers = {}) {
        const remaining = headers['x-ratelimit-remaining-day'];
        const limit = headers['x-ratelimit-limit-day'];
        if (remaining !== undefined && limit !== undefined) {
            this.log.debug(`Airly daily quota: ${remaining}/${limit} calls remaining`);
        }
    }

    handleError(err) {
        if (err.response) {
            const status = err.response.status;
            if (status === 401) {
                this.log.error('Airly API rejected the key (401). Check the apikey in the settings.');
            } else if (status === 404) {
                this.log.warn(
                    'Airly found no station near the configured point (404). Increase "Max distance" or switch mode.',
                );
            } else if (status === 429) {
                this.log.warn('Airly API rate limit reached (429). Increase the poll interval.');
            } else {
                this.log.error(`Airly API error ${status}: ${JSON.stringify(err.response.data)}`);
            }
        } else {
            this.log.error(`Request to Airly failed: ${err.message}`);
        }
    }

    onUnload(callback) {
        try {
            if (this.pollTimer) {
                this.clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
            this.setState('info.connection', { val: false, ack: true });
            callback();
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new Airly(options);
} else {
    new Airly();
}

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
        this.latitude = parseFloat(this.config.latitude);
        this.longitude = parseFloat(this.config.longitude);

        if (!apikey) {
            this.log.error('Airly API key is not configured. Open the adapter settings and enter it.');
            return;
        }
        if (Number.isNaN(this.latitude) || Number.isNaN(this.longitude)) {
            this.log.error('Latitude / longitude are not configured correctly.');
            return;
        }

        this.mode = this.config.mode === 'nearest' ? 'nearest' : 'point';
        this.maxDistanceKM = parseFloat(this.config.maxDistanceKM) || 25;
        const pollMinutes = parseInt(this.config.pollInterval, 10) || 20;

        this.http = axios.create({
            baseURL: API_BASE,
            timeout: 15000,
            headers: {
                Accept: 'application/json',
                apikey: apikey,
            },
        });

        await this.setStateChangedAsync('info.connection', { val: false, ack: true });

        // info.installationId is obsolete since v0.2.0 (point/nearest need no station id).
        this.delObjectAsync('info.installationId').catch(() => {});

        // Run immediately, then on the configured interval (setInterval is cleared on unload).
        await this.poll();
        this.pollTimer = this.setInterval(() => this.poll(), pollMinutes * 60 * 1000);
    }

    /**
     * One measurement cycle: fetch measurements for the configured point and write states.
     *
     * Airly's point/nearest measurement endpoints take lat/lng directly, so there is no
     * separate "find installation" call and no installationId to cache.
     */
    async poll() {
        try {
            const endpoint = this.mode === 'nearest' ? '/measurements/nearest' : '/measurements/point';
            const params = { lat: this.latitude, lng: this.longitude };
            if (this.mode === 'nearest') {
                params.maxDistanceKM = this.maxDistanceKM;
            }

            const res = await this.http.get(endpoint, { params });
            this.logQuota(res.headers);

            await this.writeMeasurements(res.data);
            await this.setStateChangedAsync('info.connection', { val: true, ack: true });
        } catch (err) {
            this.handleError(err);
            await this.setStateChangedAsync('info.connection', { val: false, ack: true });
        }
    }

    /**
     * Map the Airly measurements payload onto adapter states.
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
                this.log.warn('Airly found no station near the configured point (404). Increase "Max distance" or switch mode.');
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
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new Airly(options);
} else {
    new Airly();
}

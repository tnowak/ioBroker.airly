'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const { extractMeasurements } = require('./lib/extract');

const API_BASE = 'https://airapi.airly.eu/v2';
// Node-RED flow forgot the cached station after 1h, forcing a fresh "nearest" lookup.
const INSTALLATION_TTL_MS = 60 * 60 * 1000;

class Airly extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'airly' });

        this.pollTimer = null;
        this.installationId = null;
        this.installationTs = 0;

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        const apikey = (this.config.apikey || '').trim();
        const latitude = parseFloat(this.config.latitude);
        const longitude = parseFloat(this.config.longitude);

        if (!apikey) {
            this.log.error('Airly API key is not configured. Open the adapter settings and enter it.');
            return;
        }
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            this.log.error('Latitude / longitude are not configured correctly.');
            return;
        }

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

        // Run immediately, then on the configured interval (setInterval is cleared on unload).
        await this.poll();
        this.pollTimer = this.setInterval(() => this.poll(), pollMinutes * 60 * 1000);
    }

    /**
     * One measurement cycle: make sure we have a station, fetch measurements, write states.
     */
    async poll() {
        try {
            const installationId = await this.getInstallationId();
            if (installationId === null) {
                this.log.warn('No Airly station found within the configured distance.');
                await this.setStateChangedAsync('info.connection', { val: false, ack: true });
                return;
            }

            const { data } = await this.http.get('/measurements/installation', {
                params: { installationId },
            });

            await this.writeMeasurements(data);
            await this.setStateChangedAsync('info.connection', { val: true, ack: true });
        } catch (err) {
            this.handleError(err);
            await this.setStateChangedAsync('info.connection', { val: false, ack: true });
        }
    }

    /**
     * Return the nearest station id, refreshing it once the cache TTL expires.
     */
    async getInstallationId() {
        const fresh = this.installationId !== null && Date.now() - this.installationTs < INSTALLATION_TTL_MS;
        if (fresh) {
            return this.installationId;
        }

        const { data } = await this.http.get('/installations/nearest', {
            params: {
                lat: parseFloat(this.config.latitude),
                lng: parseFloat(this.config.longitude),
                maxDistanceKM: this.maxDistanceKM,
            },
        });

        if (!Array.isArray(data) || data.length === 0) {
            this.installationId = null;
            return null;
        }

        this.installationId = data[0].id;
        this.installationTs = Date.now();
        this.log.debug(`Using Airly installation ${this.installationId}`);
        await this.setStateChangedAsync('info.installationId', { val: this.installationId, ack: true });
        return this.installationId;
    }

    /**
     * Map the Airly measurements payload onto adapter states.
     */
    async writeMeasurements(payload) {
        const states = extractMeasurements(payload);
        if (!states) {
            this.log.warn('Airly response contained no "current" measurements.');
            return;
        }

        await Promise.all(
            Object.entries(states)
                .filter(([, val]) => val !== null)
                .map(([id, val]) => this.setStateChangedAsync(id, { val, ack: true })),
        );
    }

    handleError(err) {
        if (err.response) {
            const status = err.response.status;
            if (status === 401) {
                this.log.error('Airly API rejected the key (401). Check the apikey in the settings.');
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

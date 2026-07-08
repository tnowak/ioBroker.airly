'use strict';

/**
 * Turn an Airly "measurements" payload into a flat map of state -> value.
 *
 * Values are looked up by name (not by array index), because Airly does not
 * guarantee the ordering of the values/standards arrays.
 *
 * @param {object} payload raw response from /measurements/installation
 * @returns {{
 *   'pm25.value': number|null,
 *   'pm25.limitPercent': number|null,
 *   'pm10.value': number|null,
 *   'pm10.limitPercent': number|null,
 *   'caqi.value': number|null,
 *   'caqi.level': string|null,
 *   'caqi.description': string|null,
 *   'info.lastUpdate': number|null
 * }|null} flat state map, or null when there is no current measurement
 */
function extractMeasurements(payload) {
    const current = payload && payload.current;
    if (!current) {
        return null;
    }

    const value = name => {
        const item = (current.values || []).find(v => v.name === name);
        return item ? item.value : null;
    };
    const standardPercent = pollutant => {
        const item = (current.standards || []).find(s => s.pollutant === pollutant);
        return item ? item.percent : null;
    };

    const index = (current.indexes || [])[0] || {};

    return {
        'pm25.value': value('PM25'),
        'pm25.limitPercent': standardPercent('PM25'),
        'pm10.value': value('PM10'),
        'pm10.limitPercent': standardPercent('PM10'),
        'caqi.value': index.value ?? null,
        'caqi.level': index.level ?? null,
        'caqi.description': index.description ?? null,
        'info.lastUpdate': current.tillDateTime ? new Date(current.tillDateTime).getTime() : null,
    };
}

module.exports = { extractMeasurements };

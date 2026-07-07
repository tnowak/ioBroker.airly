'use strict';

const { expect } = require('chai');
const { extractMeasurements } = require('../lib/extract');

describe('extractMeasurements', () => {
    it('returns null when there is no current measurement', () => {
        expect(extractMeasurements({})).to.equal(null);
        expect(extractMeasurements(null)).to.equal(null);
    });

    it('looks up pollutants by name regardless of array order', () => {
        const payload = {
            current: {
                tillDateTime: '2026-07-07T12:00:00.000Z',
                // Deliberately shuffled to prove index-independence.
                values: [
                    { name: 'PM10', value: 30 },
                    { name: 'PM1', value: 5 },
                    { name: 'PM25', value: 12.5 },
                ],
                standards: [
                    { pollutant: 'PM10', percent: 60 },
                    { pollutant: 'PM25', percent: 50 },
                ],
                indexes: [{ value: 25.4, level: 'LOW', description: 'Great air!' }],
            },
        };

        const result = extractMeasurements(payload);

        expect(result['pm25.value']).to.equal(12.5);
        expect(result['pm25.limitPercent']).to.equal(50);
        expect(result['pm10.value']).to.equal(30);
        expect(result['pm10.limitPercent']).to.equal(60);
        expect(result['caqi.value']).to.equal(25.4);
        expect(result['caqi.level']).to.equal('LOW');
        expect(result['caqi.description']).to.equal('Great air!');
        expect(result['info.lastUpdate']).to.equal(Date.parse('2026-07-07T12:00:00.000Z'));
    });

    it('returns null for pollutants missing from the payload', () => {
        const result = extractMeasurements({
            current: { values: [], standards: [], indexes: [] },
        });

        expect(result['pm25.value']).to.equal(null);
        expect(result['pm10.limitPercent']).to.equal(null);
        expect(result['caqi.value']).to.equal(null);
        expect(result['info.lastUpdate']).to.equal(null);
    });
});

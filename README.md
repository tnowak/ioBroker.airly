# ioBroker.airly

Adapter reading air quality data (PM2.5, PM10, CAQI index) from the nearest
[Airly](https://airly.org) station. Converted from a Node-RED flow.

## Configuration

| Setting          | Meaning                                                       |
| ---------------- | ------------------------------------------------------------ |
| `apikey`         | Airly API key (developer.airly.org)                          |
| `latitude`       | Your latitude                                                 |
| `longitude`      | Your longitude                                                |
| `maxDistanceKM`  | Max distance to search for a station (km)                     |
| `pollInterval`   | How often to fetch measurements (minutes)                    |

The nearest station is looked up automatically and re-resolved once per hour.

## States

| State                   | Description                              |
| ----------------------- | ---------------------------------------- |
| `pm25.value`            | PM2.5 concentration (µg/m³)              |
| `pm25.limitPercent`     | PM2.5 as % of the norm                    |
| `pm10.value`            | PM10 concentration (µg/m³)               |
| `pm10.limitPercent`     | PM10 as % of the norm                     |
| `caqi.value`            | CAQI index value                          |
| `caqi.level`            | CAQI level (e.g. `LOW`, `MEDIUM`)         |
| `caqi.description`      | Human-readable air quality description    |
| `info.connection`       | API reachable / data valid                |
| `info.installationId`   | Currently used Airly installation id      |
| `info.lastUpdate`       | Timestamp of the last measurement         |

## Install (from folder, for development)

```bash
cd iobroker.airly
npm install
# then, on the ioBroker host:
iobroker url /path/to/iobroker.airly
```

## Differences vs. the original Node-RED flow

- MQTT publishing is replaced by ioBroker states.
- PM/standards values are looked up **by name** instead of by fixed array index
  (`values[1]`, `standards[0]`), which was fragile if Airly reorders the arrays.
- Station caching / 1h refresh logic is kept.

## License

MIT — see [LICENSE](LICENSE).

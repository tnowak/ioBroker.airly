# ioBroker.airly

Adapter reading air quality data (PM2.5, PM10, CAQI index) for your location
from [Airly](https://airly.org).

## Configuration

| Setting          | Meaning                                                          |
| ---------------- | --------------------------------------------------------------- |
| `apikey`         | Airly API key (developer.airly.org)                             |
| `latitude`       | Your latitude                                                    |
| `longitude`      | Your longitude                                                   |
| `mode`           | `point` — interpolated for your exact coordinates (default); `nearest` — data from the closest physical station |
| `maxDistanceKM`  | Search radius for the closest station (km); only used in `nearest` mode |
| `pollInterval`   | How often to fetch measurements (minutes)                       |

Each poll makes a single request to Airly's `measurements/point` (or
`measurements/nearest`) endpoint, which takes your coordinates directly — there
is no separate station lookup to manage.

Airly limits its free public API to **100 calls per day** — about one call every
15 minutes. Keep `pollInterval` at **20 minutes or longer** (≈72 calls/day) to
stay comfortably within the quota. The remaining daily quota is written to the
debug log on every poll.

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
| `info.lastUpdate`       | Timestamp of the last measurement         |

## Installation

This adapter is not part of the official ioBroker repository, so install it
straight from GitHub:

- **In the ioBroker admin:** open **Adapters**, click the **install from custom
  URL** icon (the GitHub/cat icon in the toolbar), go to the **From own URL /
  GitHub** tab and enter the repository URL:

  ```
  https://github.com/tnowak/ioBroker.airly
  ```

- **Or from the command line** on the ioBroker host:

  ```bash
  iobroker url https://github.com/tnowak/ioBroker.airly
  ```

After installing, add an instance and fill in your Airly API key and
coordinates.

## License

MIT — see [LICENSE](LICENSE).

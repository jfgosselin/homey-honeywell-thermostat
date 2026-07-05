Honeywell Z-Wave Thermostat for Homey

This app adds Homey support for the Honeywell TH8320ZW (and other compatible Honeywell Z-Wave thermostats).

It allows you to seamlessly integrate your Honeywell thermostat into your smart home, enabling full control over temperature, operating modes, and fan settings directly from the Homey app or your automated Flows.

Features

- Set Target Temperature: Adjust your heating or cooling setpoint.
- View Current Temperature: Monitor the ambient room temperature.
- Operating State: See whether the system is currently idle, heating, or cooling.
- Thermostat Modes: Switch between Off, Heat, Cool, and Emergency Heat.
- Fan Modes: Control the fan mode: Auto, On, or Circulate.
- Homey Climate Dial: Control mode and setpoint directly from Homey's native thermostat dial and from Flows.
- Native Z-Wave Integration: Built on the homey-zwavedriver library for reliable, responsive command handling.

Note on Auto Changeover

The thermostat's "Auto" changeover mode uses two setpoints at once (separate heating and cooling targets with a deadband between them). Homey's thermostat interface currently supports a single target temperature, so Auto cannot be represented cleanly. For the best experience, keep the thermostat in Manual changeover (Installer Function 0300 = 0) and use the Off, Heat, Cool, and Emergency Heat modes.

Supported Devices

- Honeywell TH8320ZW (Z-Wave Touchscreen Thermostat)

Installation Instructions

1. Pairing the Thermostat
If you haven't already, pair your thermostat to your Homey Pro via Z-Wave:
1. On your Homey Pro, go to Devices > + (Add Device).
2. Search for the Honeywell Z-Wave Thermostat app and select your device.
3. Put the thermostat into Z-Wave pairing mode (refer to the thermostat's manual for specific instructions, typically done through the installer setup menu).
4. Follow the on-screen instructions in the Homey app.

Disclaimer

This is an unofficial, community-developed app. It is not affiliated with, authorized by, or endorsed by Honeywell or Resideo. "Honeywell" and all related names, marks, and logos are trademarks of their respective owners.

License

This project is released under the MIT License. See the LICENSE file for details.

'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

/**
 * Single source of truth for the THERMOSTAT_MODE mapping.
 * - capability: value of the `thermostat_mode_custom` Homey capability
 * - zwave / zwaveId: Z-Wave mode name / numeric value (a device may report either)
 * - setpoint: THERMOSTAT_SETPOINT type that `target_temperature` controls in this mode
 * Homey shows "Emergency Heat"; the Z-Wave enum name is "Auxiliary Heat" — both are kept.
 */
const THERMOSTAT_MODES = [
  { capability: 'heat', zwave: 'Heat', zwaveId: 1, setpoint: 'Heating 1' },
  { capability: 'cool', zwave: 'Cool', zwaveId: 2, setpoint: 'Cooling 1' },
  { capability: 'emergency_heat', zwave: 'Auxiliary Heat', zwaveId: 4, setpoint: 'Heating 1' },
];

/** THERMOSTAT_FAN_MODE mapping (Homey value <-> Z-Wave name / numeric value). */
const FAN_MODES = [
  { capability: 'auto', zwave: 'Auto Low', zwaveId: 0 },
  { capability: 'on', zwave: 'Low', zwaveId: 1 },
  { capability: 'circulate', zwave: 'Circulation', zwaveId: 6 },
];

class HoneywellThermostatDevice extends ZwaveDevice {
  /**
   * onNodeInit is called when the Z-Wave node has been initialized.
   */
  async onNodeInit() {
    this.log('Honeywell TH8320ZW node has been initialized');

    // Last active (non-off) mode, so the onoff toggle restores it instead of forcing Heat.
    // Defaults to Heat; re-synced from the device on start via getOnStart.
    this._lastMode = 'Heat';

    // Migrate existing devices to the current capability set
    if (!this.hasCapability('thermostat_mode_custom')) {
      await this.addCapability('thermostat_mode_custom').catch(this.error);
    }
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff').catch(this.error);
    }
    if (!this.hasCapability('thermostat_fan_mode_custom')) {
      await this.addCapability('thermostat_fan_mode_custom').catch(this.error);
    }
    if (!this.hasCapability('thermostat_state')) {
      await this.addCapability('thermostat_state').catch(this.error);
    }
    if (this.hasCapability('target_temperature.cool')) {
      await this.removeCapability('target_temperature.cool').catch(this.error);
    }
    if (this.hasCapability('thermostat_mode')) {
      await this.removeCapability('thermostat_mode').catch(this.error);
    }

    // ONOFF — master switch mapped onto THERMOSTAT_MODE (on = last active mode, off = Off).
    this.registerCapability('onoff', 'THERMOSTAT_MODE', {
      get: 'THERMOSTAT_MODE_GET',
      getOpts: { getOnStart: true },
      set: 'THERMOSTAT_MODE_SET',
      setParser: value => ({
        Level: { 'No of Dict. entries': 0, Mode: value ? this._lastMode : 'Off' },
      }),
      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: report => {
        const mode = report?.Level?.Mode;
        if (mode == null) return null;
        return mode !== 'Off' && mode !== 0;
      },
    });

    // SENSOR_MULTILEVEL — air temperature.
    this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');

    // THERMOSTAT_SETPOINT — target_temperature follows the active mode's setpoint type.
    // Celsius is the default; also accept Fahrenheit reports (Scale 1) and convert to Celsius
    // (the library's system parser only handles Scale 0, so it would otherwise drop °F reports).
    this.thermostatSetpointType = 'Heating 1';
    this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
      reportParserOverride: true,
      reportParser: report => {
        // The device reports both its heating and cooling setpoints; accept only the one for the
        // currently-active type, else the dial flickers to the other value. (If the report omits
        // the type, fall through and accept it — never stop updating.)
        const type = report?.Level?.['Setpoint Type'];
        if (type != null && type !== this.thermostatSetpointType) return null;
        const info = report?.Level2;
        if (!info || info.Scale == null || info.Size == null || info.Precision == null) {
          return null;
        }
        let raw;
        try {
          raw = report.Value.readUIntBE(0, info.Size);
        } catch (err) {
          return null;
        }
        const value = raw / (10 ** info.Precision);
        // Scale 0 = Celsius (default); Scale 1 = Fahrenheit -> convert to Celsius.
        const celsius = info.Scale === 1 ? (value - 32) * 5 / 9 : value;
        return Math.round(celsius * 10) / 10;
      },
    });

    // THERMOSTAT_MODE — Off / Heat / Cool / Emergency Heat.
    this.registerCapability('thermostat_mode_custom', 'THERMOSTAT_MODE', {
      get: 'THERMOSTAT_MODE_GET',
      getOpts: { getOnStart: true },
      set: 'THERMOSTAT_MODE_SET',
      setParser: value => {
        const entry = THERMOSTAT_MODES.find(m => m.capability === value);
        if (entry) {
          this._syncSetpointType(entry.setpoint);
          this._lastMode = entry.zwave;
        }
        return { Level: { 'No of Dict. entries': 0, Mode: entry?.zwave ?? 'Off' } };
      },
      report: 'THERMOSTAT_MODE_REPORT',
      reportParser: report => {
        const mode = report?.Level?.Mode;
        if (mode == null) return null;
        const entry = THERMOSTAT_MODES.find(m => m.zwave === mode || m.zwaveId === mode);
        if (!entry) return 'off'; // Off, Auto, Energy-Saving, etc. -> off (see README note on Auto)
        this._syncSetpointType(entry.setpoint);
        this._lastMode = entry.zwave;
        return entry.capability;
      },
    });

    // THERMOSTAT_FAN_MODE — Auto / On / Circulate.
    this.registerCapability('thermostat_fan_mode_custom', 'THERMOSTAT_FAN_MODE', {
      get: 'THERMOSTAT_FAN_MODE_GET',
      getOpts: { getOnStart: true },
      set: 'THERMOSTAT_FAN_MODE_SET',
      setParser: value => {
        const entry = FAN_MODES.find(m => m.capability === value);
        return { Properties1: { Off: false, 'Fan Mode': entry?.zwave ?? 'Auto Low' } };
      },
      report: 'THERMOSTAT_FAN_MODE_REPORT',
      reportParser: report => {
        const mode = report?.Properties1?.['Fan Mode'];
        if (mode == null) return null;
        const entry = FAN_MODES.find(m => m.zwave === mode || m.zwaveId === mode);
        return entry?.capability ?? 'auto';
      },
    });

    // THERMOSTAT_OPERATING_STATE — read-only: is the HVAC idle, heating, or cooling.
    this.registerCapability('thermostat_state', 'THERMOSTAT_OPERATING_STATE', {
      get: 'THERMOSTAT_OPERATING_STATE_GET',
      getOpts: { getOnStart: true },
      report: 'THERMOSTAT_OPERATING_STATE_REPORT',
      reportParser: report => {
        const raw = report?.Level?.['Operating State'];
        if (raw == null) return null;
        let value = 'idle'; // Idle (0), Fan Only (3), Pending Heat (4), Pending Cool (5)
        if (raw === 'Heating' || raw === 1) value = 'heating';
        else if (raw === 'Cooling' || raw === 2) value = 'cooling';
        // Fire the Flow trigger only on a real change (not the initial getOnStart population).
        const prev = this.getCapabilityValue('thermostat_state');
        const trigger = this.driver.operatingStateChangedTrigger;
        if (trigger && prev != null && prev !== value) {
          trigger.trigger(this, {}, { state: value }).catch(this.error);
        }
        return value;
      },
    });
  }

  /**
   * Point `target_temperature` at the given THERMOSTAT_SETPOINT type. When the type actually
   * changes (e.g. Heat -> Cool) re-fetch the setpoint, so the dial shows the correct heating/
   * cooling value immediately instead of waiting for the next report or poll (fixes boot-time
   * and mode-change staleness).
   */
  _syncSetpointType(type) {
    if (this.thermostatSetpointType === type) return;
    this.thermostatSetpointType = type;
    this._getCapabilityValue('target_temperature', 'THERMOSTAT_SETPOINT').catch(this.error);
  }
}

module.exports = HoneywellThermostatDevice;

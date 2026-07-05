'use strict';

const Homey = require('homey');

class HoneywellThermostatDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('Honeywell TH8320ZW driver has been initialized');

    // Flow trigger: "The operating state became ..." — fired by the device on a real change.
    this.operatingStateChangedTrigger = this.homey.flow.getDeviceTriggerCard('operating_state_changed');
    this.operatingStateChangedTrigger.registerRunListener((args, state) => args.state === state.state);

    // Flow condition: "The operating state is / is not ...".
    this.homey.flow.getConditionCard('operating_state_is')
      .registerRunListener(args => args.device.getCapabilityValue('thermostat_state') === args.state);
  }
}

module.exports = HoneywellThermostatDriver;

'use strict';

const Homey = require('homey');

class HoneywellApp extends Homey.App {
  /**
   * onInit is called when the app is initialized
   */
  async onInit() {
    this.log('Honeywell Z-Wave app has been initialized');
  }
}

module.exports = HoneywellApp;

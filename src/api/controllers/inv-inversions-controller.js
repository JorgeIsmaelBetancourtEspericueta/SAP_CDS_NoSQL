//Import libraries

const cds = require("@sap/cds");

const {
  crudSimulation
} = require("../services/inv-inversions-services");
//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
    //Call method handler the parent constructor
    this.on("crudSimulation", async (req) => {
      // call the service method and return the result to route.
      return crudSimulation(req);
    });

    return await super.init();
  }
}

// Export the controller class
module.exports = InversionsClass;

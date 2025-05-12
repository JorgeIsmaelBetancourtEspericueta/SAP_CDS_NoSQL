//Import libraries

const cds = require("@sap/cds");

const {
  crudSimulation,
  crudStrategies,
  company,
  strategy,
} = require("../services/inv-inversions-services");

//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
    //Call method handler the parent constructor
    this.on("crudSimulation", async (req) => {
      try {
        return await crudSimulation(req);
      } catch (error) {
        req.error(400, error.message || "Error en crudSimulation");
      }
    });

    this.on("crudStrategies", async (req) => {
      try {
        return await crudStrategies(req);
      } catch (error) {
        req.error(400, error.message || "Error en crudStrategies");
      }
    });

    this.on("company", async (req) => {
      try {
        return await company(req);
      } catch (error) {
        req.error(400, error.message || "Error en company");
      }
    });

    this.on("strategy", async (req) =>{
      try {
        return await strategy(req);
      }catch (error) {
        req.error(400, error.message || "Error en strategy");
      }
    });

    return await super.init();
  } //cierre init
} //fin de la clase

// Export the controller class
module.exports = InversionsClass;

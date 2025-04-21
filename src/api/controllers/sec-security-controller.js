//Import libraries

const cds = require("@sap/cds");

const {
  GetLabelsWithValues,
  DeleteRecord,
  CrudUsers,
  CrudValues,
  CrudRoles,
} = require("../services/sec-security-service");
//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
    this.on("catalogs", async (req) => {
      // call the service method and return the result to route.
      return GetLabelsWithValues(req);
    });

    this.on("crudUsers", async (req) => {
      return CrudUsers(req);
    });
    
    this.on("crudValues", async (req) => {
      return CrudValues(req);
    });

    this.on("crudRoles", async (req) => {
      return CrudRoles(req);
    });

    this.on("delete", async (req) => {
      // call the service method and return the result to route.
      return DeleteRecord(req);
    });

    return await super.init();
  }
}

// Export the controller class
module.exports = InversionsClass;

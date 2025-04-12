//Import libraries

const cds = require("@sap/cds");

const {
  GetLabelsWithValues,
  GetUserInfo,
  CreateUser,
  DeleteRecord,
  CreateValue,
  UpdateValue,
  GetRoles,
  GetUserRoles,
  CreateRole,
  UpdateRole,
} = require("../services/sec-security-service");
//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
    this.on("catalogs", async (req) => {
      // call the service method and return the result to route.
      return GetLabelsWithValues(req);
    });

    this.on("users", async (req) => {
      // call the service method and return the result to route.
      return GetUserInfo(req);
    });

    this.on("createuser", async (req) => {
      // call the service method and return the result to route.
      return CreateUser(req);
    });

    this.on("delete", async (req) => {
      // call the service method and return the result to route.
      return DeleteRecord(req);
    });

    this.on("createvalue", async (req) => {
      return CreateValue(req);
    });

    this.on("updatevalue", async (req) => {
      return UpdateValue(req);
    });
    this.on("getUserRoles", async (req) => {
      // call the service method and return the result to route.
      return GetUserRoles(req);
    });

    this.on("roles", async (req) => {
      // call the service method and return the result to route.
      return GetRoles(req);
    });

    this.on("createrole", async (req) => {
      // call the service method and return the result to route.
      return CreateRole(req);
    });

    this.on("updaterole", async (req) => {
      // call the service method and return the result to route.
      return UpdateRole(req);
    });

    return await super.init();
  }
}

// Export the controller class
module.exports = InversionsClass;

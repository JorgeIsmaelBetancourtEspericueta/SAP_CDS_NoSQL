const mongoose = require("mongoose");

// Servicio para hacer el lookup entre ZTLABELS y SS
async function GetLabelsWithValues(req) {
  try {
    const labelid = req?.req?.query?.labelid;
    const valueid = req?.req?.query?.valueid;

    let result;

    if (!labelid && !valueid) {
      // Caso 1: No hay labelid ni valueid
      result = await mongoose.connection
        .collection("ZTLABELS")
        .aggregate([
          {
            $lookup: {
              from: "SS",
              localField: "LABELID",
              foreignField: "LABELID",
              as: "VALUES",
            },
          },
        ])
        .toArray();
    } else if (labelid && !valueid) {
      // Caso 2: Solo hay labelid
      result = await mongoose.connection
        .collection("ZTLABELS")
        .aggregate([
          {
            $match: { LABELID: labelid },
          },
          {
            $lookup: {
              from: "SS",
              localField: "LABELID",
              foreignField: "LABELID",
              as: "VALUES",
            },
          },
        ])
        .toArray();
    } else if (labelid && valueid) {
      // Caso 3: Hay labelid y valueid
      result = await mongoose.connection
        .collection("ZTLABELS")
        .aggregate([
          {
            $match: { LABELID: labelid },
          },
          {
            $lookup: {
              from: "SS",
              localField: "LABELID",
              foreignField: "LABELID",
              as: "VALUES",
            },
          },
          {
            $addFields: {
              VALUES: {
                $filter: {
                  input: "$VALUES",
                  as: "val",
                  cond: { $eq: ["$$val.VALUEID", valueid] },
                },
              },
            },
          },
        ])
        .toArray();
    }

    return result;
  } catch (error) {
    console.error("Error en la agregación con $lookup:", error.message);
    throw error;
  }
}

// Servicio para obtener usuarios con sus roles, procesos, vistas y aplicaciones
async function GetUserInfo(req) {
  try {
    let result;

    const userid = req?.req?.query?.userid;

    if (!userid) {
      result = await mongoose.connection
        .collection("ZTUSERS")
        .aggregate([
          {
            $lookup: {
              from: "ZTROLES",
              localField: "ROLES.ROLEID",
              foreignField: "ROLEID",
              as: "ROLE_DETAILS",
            },
          },
          { $unwind: "$ROLES" },
          {
            $addFields: {
              ROLE_DETAIL: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$ROLE_DETAILS",
                      as: "detail",
                      cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
          {
            $lookup: {
              from: "SS",
              let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$LABELID", "IdProcesses"] },
                        {
                          $eq: [
                            { $concat: ["IdProcess-", "$VALUEID"] },
                            "$$processId",
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "SS",
                    let: { viewId: "$VALUEPAID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdViews"] },
                              {
                                $eq: [
                                  { $concat: ["IdViews-", "$VALUEID"] },
                                  "$$viewId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "SS",
                          let: { appId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdApplications"] },
                                    {
                                      $eq: [
                                        {
                                          $concat: [
                                            "IdApplications-",
                                            "$VALUEID",
                                          ],
                                        },
                                        "$$appId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                          as: "application",
                        },
                      },
                      {
                        $addFields: {
                          application: { $arrayElemAt: ["$application", 0] },
                        },
                      },
                    ],
                    as: "view",
                  },
                },
                {
                  $addFields: {
                    view: { $arrayElemAt: ["$view", 0] },
                  },
                },
              ],
              as: "PROCESS_INFO",
            },
          },
          {
            $addFields: {
              PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id",
                roleId: "$ROLES.ROLEID",
                processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
              },
              PROCESS: {
                $first: {
                  PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                  PROCESSNAME: "$PROCESS_INFO.VALUE",
                  VIEWID: "$PROCESS_INFO.view.VALUEID",
                  VIEWNAME: "$PROCESS_INFO.view.VALUE",
                  APPLICATIONID: "$PROCESS_INFO.view.application.VALUEID",
                  APPLICATIONNAME: "$PROCESS_INFO.view.application.VALUE",
                  PRIVILEGES: {
                    $map: {
                      input: "$ROLE_DETAIL.PRIVILEGES.PRIVILEGEID",
                      as: "privId",
                      in: {
                        PRIVILEGEID: "$$privId",
                        PRIVILEGENAME: "$$privId",
                      },
                    },
                  },
                },
              },
              ROLE_META: { $first: "$ROLES" },
              ROLE_DETAILS: {
                $first: {
                  ROLEID: "$ROLE_DETAIL.ROLEID",
                  ROLENAME: "$ROLE_DETAIL.ROLENAME",
                  DESCRIPTION: "$ROLE_DETAIL.DESCRIPTION",
                  DETAIL_ROW: "$ROLE_DETAIL.DETAIL_ROW",
                },
              },
              USER: { $first: "$$ROOT" },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id.userId",
                roleId: "$_id.roleId",
              },
              ROLEID: { $first: "$ROLE_META.ROLEID" },
              ROLEIDSAP: { $first: "$ROLE_META.ROLEIDSAP" },
              ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
              DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
              DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
              PROCESSES: { $push: "$PROCESS" },
              USER: { $first: "$USER" },
            },
          },
          {
            $group: {
              _id: "$_id.userId",
              ROLES: {
                $push: {
                  ROLEID: "$ROLEID",
                  ROLEIDSAP: "$ROLEIDSAP",
                  ROLENAME: "$ROLENAME",
                  DESCRIPTION: "$DESCRIPTION",
                  DETAIL_ROW: "$DETAIL_ROW",
                  PROCESSES: "$PROCESSES",
                },
              },
              USER: { $first: "$USER" },
            },
          },
          {
            $project: {
              _id: 0,
              USERID: "$USER.USERID",
              PASSWORD: "$USER.PASSWORD",
              USERNAME: "$USER.USERNAME",
              ALIAS: "$USER.ALIAS",
              FIRSTNAME: "$USER.FIRSTNAME",
              LASTNAME: "$USER.LASTNAME",
              BIRTHDAYDATE: "$USER.BIRTHDAYDATE",
              COMPANYID: "$USER.COMPANYID",
              COMPANYNAME: "$USER.COMPANYNAME",
              COMPANYALIAS: "$USER.COMPANYALIAS",
              CEDIID: "$USER.CEDIID",
              EMPLOYEEID: "$USER.EMPLOYEEID",
              EMAIL: "$USER.EMAIL",
              PHONENUMBER: "$USER.PHONENUMBER",
              EXTENSION: "$USER.EXTENSION",
              DEPARTMENT: "$USER.DEPARTMENT",
              FUNCTION: "$USER.FUNCTION",
              STREET: "$USER.STREET",
              POSTALCODE: "$USER.POSTALCODE",
              CITY: "$USER.CITY",
              REGION: "$USER.REGION",
              STATE: "$USER.STATE",
              COUNTRY: "$USER.COUNTRY",
              AVATAR: "$USER.AVATAR",
              DETAIL_ROW: "$USER.DETAIL_ROW",
              ROLES: "$ROLES",
            },
          },
        ])
        .toArray();
    } else {
      result = await mongoose.connection
        .collection("ZTUSERS")
        .aggregate([
          {
            $match: { USERID: userid },
          },
          // Aquí va exactamente el mismo pipeline que en el if anterior
          {
            $lookup: {
              from: "ZTROLES",
              localField: "ROLES.ROLEID",
              foreignField: "ROLEID",
              as: "ROLE_DETAILS",
            },
          },
          { $unwind: "$ROLES" },
          {
            $addFields: {
              ROLE_DETAIL: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$ROLE_DETAILS",
                      as: "detail",
                      cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
          {
            $lookup: {
              from: "SS",
              let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$LABELID", "IdProcesses"] },
                        {
                          $eq: [
                            { $concat: ["IdProcess-", "$VALUEID"] },
                            "$$processId",
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "SS",
                    let: { viewId: "$VALUEPAID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdViews"] },
                              {
                                $eq: [
                                  { $concat: ["IdViews-", "$VALUEID"] },
                                  "$$viewId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "SS",
                          let: { appId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdApplications"] },
                                    {
                                      $eq: [
                                        {
                                          $concat: [
                                            "IdApplications-",
                                            "$VALUEID",
                                          ],
                                        },
                                        "$$appId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                          as: "application",
                        },
                      },
                      {
                        $addFields: {
                          application: { $arrayElemAt: ["$application", 0] },
                        },
                      },
                    ],
                    as: "view",
                  },
                },
                {
                  $addFields: {
                    view: { $arrayElemAt: ["$view", 0] },
                  },
                },
              ],
              as: "PROCESS_INFO",
            },
          },
          {
            $addFields: {
              PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id",
                roleId: "$ROLES.ROLEID",
                processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
              },
              PROCESS: {
                $first: {
                  PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                  PROCESSNAME: "$PROCESS_INFO.VALUE",
                  VIEWID: "$PROCESS_INFO.view.VALUEID",
                  VIEWNAME: "$PROCESS_INFO.view.VALUE",
                  APPLICATIONID: "$PROCESS_INFO.view.application.VALUEID",
                  APPLICATIONNAME: "$PROCESS_INFO.view.application.VALUE",
                  PRIVILEGES: {
                    $map: {
                      input: "$ROLE_DETAIL.PRIVILEGES.PRIVILEGEID",
                      as: "privId",
                      in: {
                        PRIVILEGEID: "$$privId",
                        PRIVILEGENAME: "$$privId",
                      },
                    },
                  },
                },
              },
              ROLE_META: { $first: "$ROLES" },
              ROLE_DETAILS: {
                $first: {
                  ROLEID: "$ROLE_DETAIL.ROLEID",
                  ROLENAME: "$ROLE_DETAIL.ROLENAME",
                  DESCRIPTION: "$ROLE_DETAIL.DESCRIPTION",
                  DETAIL_ROW: "$ROLE_DETAIL.DETAIL_ROW",
                },
              },
              USER: { $first: "$$ROOT" },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id.userId",
                roleId: "$_id.roleId",
              },
              ROLEID: { $first: "$ROLE_META.ROLEID" },
              ROLEIDSAP: { $first: "$ROLE_META.ROLEIDSAP" },
              ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
              DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
              DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
              PROCESSES: { $push: "$PROCESS" },
              USER: { $first: "$USER" },
            },
          },
          {
            $group: {
              _id: "$_id.userId",
              ROLES: {
                $push: {
                  ROLEID: "$ROLEID",
                  ROLEIDSAP: "$ROLEIDSAP",
                  ROLENAME: "$ROLENAME",
                  DESCRIPTION: "$DESCRIPTION",
                  DETAIL_ROW: "$DETAIL_ROW",
                  PROCESSES: "$PROCESSES",
                },
              },
              USER: { $first: "$USER" },
            },
          },
          {
            $project: {
              _id: 0,
              USERID: "$USER.USERID",
              PASSWORD: "$USER.PASSWORD",
              USERNAME: "$USER.USERNAME",
              ALIAS: "$USER.ALIAS",
              FIRSTNAME: "$USER.FIRSTNAME",
              LASTNAME: "$USER.LASTNAME",
              BIRTHDAYDATE: "$USER.BIRTHDAYDATE",
              COMPANYID: "$USER.COMPANYID",
              COMPANYNAME: "$USER.COMPANYNAME",
              COMPANYALIAS: "$USER.COMPANYALIAS",
              CEDIID: "$USER.CEDIID",
              EMPLOYEEID: "$USER.EMPLOYEEID",
              EMAIL: "$USER.EMAIL",
              PHONENUMBER: "$USER.PHONENUMBER",
              EXTENSION: "$USER.EXTENSION",
              DEPARTMENT: "$USER.DEPARTMENT",
              FUNCTION: "$USER.FUNCTION",
              STREET: "$USER.STREET",
              POSTALCODE: "$USER.POSTALCODE",
              CITY: "$USER.CITY",
              REGION: "$USER.REGION",
              STATE: "$USER.STATE",
              COUNTRY: "$USER.COUNTRY",
              AVATAR: "$USER.AVATAR",
              DETAIL_ROW: "$USER.DETAIL_ROW",
              ROLES: "$ROLES",
            },
          },
        ])
        .toArray();
    }

    return result;
  } catch (error) {
    console.error(
      "Error en la agregación de usuario-rol-proceso:",
      error.message
    );
    throw error;
  }
}

// Servicio para crear un nuevo usuario
async function CreateUser(req) {
  try {
    const {
      USERID,
      USERNAME,
      ALIAS,
      FIRSTNAME,
      LASTNAME,
      BIRTHDAYDATE,
      COMPANYID,
      COMPANYNAME,
      COMPANYALIAS,
      CEDIID,
      EMPLOYEEID,
      EMAIL,
      PHONENUMBER,
      EXTENSION,
      DEPARTMENT,
      FUNCTION,
      STREET,
      POSTALCODE,
      CITY,
      REGION,
      STATE,
      COUNTRY,
      ROLES,
      reguser,
    } = req?.req?.body?.users;

    const currentDate = new Date();

    // Sección para DETAIL_ROW_REG
    const detailRowReg = [
      {
        CURRENT: false,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
      {
        CURRENT: true,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
    ];

    // ✅ Verificación de existencia de roles en la colección ZTROLES
    const roleIds = ROLES?.map((role) => role.ROLEID) || [];

    const existingRoles = await mongoose.connection
      .collection("ZTROLES")
      .find({ ROLEID: { $in: roleIds } })
      .project({ ROLEID: 1 }) // Solo obtenemos el campo ROLEID
      .toArray();

    const existingRoleIds = existingRoles.map((role) => role.ROLEID);

    const missingRoles = roleIds.filter(
      (roleId) => !existingRoleIds.includes(roleId)
    );

    if (missingRoles.length > 0) {
      return {
        message: "Algunos roles no existen en ZTROLES",
        missingRoles,
      };
    }

    // Crear el nuevo objeto de usuario
    const newUser = {
      USERID,
      USERNAME,
      ALIAS: ALIAS || "",
      FIRSTNAME,
      LASTNAME,
      BIRTHDAYDATE: BIRTHDAYDATE || "",
      COMPANYID: COMPANYID || "",
      COMPANYNAME: COMPANYNAME || "",
      COMPANYALIAS: COMPANYALIAS || "",
      CEDIID: CEDIID || "",
      EMPLOYEEID: EMPLOYEEID || "",
      EMAIL,
      PHONENUMBER: PHONENUMBER || "",
      EXTENSION: EXTENSION || "",
      DEPARTMENT: DEPARTMENT || "",
      FUNCTION: FUNCTION || "",
      STREET: STREET || "",
      POSTALCODE: POSTALCODE || "",
      CITY: CITY || "",
      REGION: REGION || "",
      STATE: STATE || "",
      COUNTRY: COUNTRY || "",
      ROLES: ROLES || [],
      DETAIL_ROW: {
        ACTIVED: true,
        DELETED: false,
        DETAIL_ROW_REG: detailRowReg,
      },
    };

    const result = await mongoose.connection
      .collection("ZTUSERS")
      .insertOne(newUser);

    return {
      message: "Usuario creado exitosamente",
      userId: result.insertedId,
    };
  } catch (error) {
    console.error("Error al crear el usuario:", error.message);
    throw error;
  }
}
async function updateoneuser(req) {
  try {
    const { userid, roleid } = req?.req?.query;
    const { users } = req?.req?.body;

    if (!userid || !users || typeof users !== "object") {
      return {
        error: true,
        message: "Faltan datos requeridos: USERID o body inválido."
      };
    }

    // Verifica si se va a modificar un rol existente
    if (roleid && users?.ROLES?.[0]?.ROLEID) {
      const newRoleId = users.ROLES[0].ROLEID;

      // Verificar si el nuevo rol ya está asignado
      const userData = await mongoose.connection.collection("ZTUSERS").findOne({ USERID: userid });
      if (!userData) {
        return {
          error: true,
          message: `No se encontró el usuario '${userid}'.`
        };
      }

      const alreadyHasNewRole = userData.ROLES?.some(r => r.ROLEID === newRoleId);
      if (alreadyHasNewRole) {
        return {
          error: true,
          message: `El usuario ya tiene asignado el ROLEID '${newRoleId}'.`
        };
      }

      const hasOldRole = userData.ROLES?.some(r => r.ROLEID === roleid);
      if (!hasOldRole) {
        return {
          error: true,
          message: `El usuario no tiene el ROLEID '${roleid}' asignado.`
        };
      }

      // Verifica si el nuevo ROLEID existe
      const newRoleData = await mongoose.connection.collection("ZTROLES").findOne({ ROLEID: newRoleId });
      if (!newRoleData) {
        return {
          error: true,
          message: `El nuevo ROLEID '${newRoleId}' no existe en ZTROLES.`
        };
      }

      // Actualiza el rol en la posición correspondiente
      await mongoose.connection.collection("ZTUSERS").updateOne(
        {
          USERID: userid,
          "ROLES.ROLEID": roleid
        },
        {
          $set: {
            "ROLES.$.ROLEID": newRoleId
          }
        }
      );
    }

    // Prepara campos adicionales a actualizar (sin ROLES)
    const { ROLES, ...otherFields } = users;

    // Actualiza los otros campos si hay alguno
    if (Object.keys(otherFields).length > 0) {
      await mongoose.connection.collection("ZTUSERS").updateOne(
        { USERID: userid },
        { $set: otherFields }
      );
    }

    // Si no se especificó roleid pero sí se quiere agregar uno nuevo
    if (!roleid && users?.ROLES?.[0]?.ROLEID) {
      const newRoleId = users.ROLES[0].ROLEID;

      const newRoleData = await mongoose.connection.collection("ZTROLES").findOne({ ROLEID: newRoleId });
      if (!newRoleData) {
        return {
          error: true,
          message: `El ROLEID '${newRoleId}' no existe en ZTROLES.`
        };
      }

      const userData = await mongoose.connection.collection("ZTUSERS").findOne({ USERID: userid });
      const alreadyHasRole = userData?.ROLES?.some(r => r.ROLEID === newRoleId);
      if (alreadyHasRole) {
        return {
          error: true,
          message: `El usuario ya tiene asignado el ROLEID '${newRoleId}'.`
        };
      }

      // Agrega el nuevo rol
      await mongoose.connection.collection("ZTUSERS").updateOne(
        { USERID: userid },
        {
          $push: {
            ROLES: {
              ROLEID: newRoleData.ROLEID
             
            }
          }
        }
      );
    }

    return {
      message: `El usuario '${userid}' fue actualizado correctamente.`
    };

  } catch (err) {
    return {
      error: true,
      message: `Ocurrió un error al actualizar el usuario: ${err.message}`
    };
  }
}






// Servicio para eliminar un registro de la colección correspondiente (por query params)

async function DeleteRecord(req) {
  try {
    // Extraer los parámetros del request
    const { roleid, valueid, labelid, userid, borrado } = req?.req?.query || {};

    // Validación: al menos un ID debe estar presente
    if (!labelid && !userid && !roleid && !valueid) {
      throw new Error("Se debe proporcionar al menos un ID para eliminar");
    }

    const currentDate = new Date();

    // Función para marcar como eliminado según tipo (lógico o físico)
    const deleteFromCollection = async (collection, fieldName, value) => {
      const filter = { [fieldName]: value };

      // Campos a modificar según el tipo de eliminación
      const updateFields = {
        "DETAIL_ROW.ACTIVED": false,
        "DETAIL_ROW.DELETED": true,
        "DETAIL_ROW.DELETEDDATE": currentDate,
      };

      if (borrado !== "fisic") {
        updateFields["DETAIL_ROW.DELETED"] = false;
      }

      const result = await mongoose.connection
        .collection(collection)
        .updateOne(filter, { $set: updateFields });

      if (result.modifiedCount === 0) {
        throw new Error(
          `No se pudo actualizar el registro en la colección ${collection}`
        );
      }

      return {
        message: `Registro marcado como eliminado ${
          borrado === "fisic" ? "físicamente" : "lógicamente"
        } en la colección ${collection}`,
      };
    };

    // Lógica según qué ID se proporciona (usa claves personalizadas en mayúsculas)
    if (labelid)
      return await deleteFromCollection("ZTLABELS", "LABELID", labelid);
    if (userid) return await deleteFromCollection("ZTUSERS", "USERID", userid);
    if (roleid) return await deleteFromCollection("ZTROLES", "ROLEID", roleid);
    if (valueid)
      return await deleteFromCollection("ZTVALUES", "VALUEID", valueid);
  } catch (error) {
    console.error("Error al eliminar el registro:", error.message);
    throw error;
  }
}

// Servicio para crear un nuevo ZTVALUES
async function CreateValue(req) {
  try {
    // Desestructuración para una aplicación
    const {
      COMPANYID,
      CEDIID,
      LABELID,
      VALUEPAID,
      VALUEID,
      VALUE,
      ALIAS,
      SEQUENCE,
      IMAGE,
      VALUESAPID,
      DESCRIPTION,
      ROUTE,
      ACTIVED = true,
      DELETED = false,
      reguser,
    } = req?.req?.body?.values;

    const currentDate = new Date();

    // Sección para DETAIL_ROW_REG
    const detailRowReg = [
      {
        CURRENT: false,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
      {
        CURRENT: true,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
    ];

    // Validaciones
    const validLabels = [
      "IdApplications",
      "IdViews",
      "IdProcesses",
      "IdRoles",
      "IdPrivileges",
    ];

    if (!validLabels.includes(LABELID)) {
      throw new Error(
        `LABELID debe ser uno de los siguientes: ${validLabels.join(", ")}`
      );
    }

    if (LABELID === "IdApplications" && VALUEPAID) {
      throw new Error(
        "VALUEPAID debe estar vacío cuando LABELID es IdApplications, ya que no tiene padre."
      );
    }

    if (LABELID !== "IdApplications") {
      // Verificar que VALUEPAID esté en el formato esperado y que el ID padre exista
      const labelIndex = validLabels.indexOf(LABELID);
      const parentLabel = validLabels[labelIndex - 1]; // El padre del LABELID actual

      // Validar el formato de VALUEPAID (sin espacios alrededor del guion)
      const regex = new RegExp(`^${parentLabel}-[A-Za-z0-9]+$`);
      if (!regex.test(VALUEPAID)) {
        throw new Error(
          `VALUEPAID debe seguir el formato "${parentLabel}-<IdRegistro>" sin espacios alrededor del guion.`
        );
      }

      // Verificar la existencia del ID padre en la colección
      const parentId = VALUEPAID.split("-")[1]; // Extraer el ID del registro padre
      const parentExists = await mongoose.connection
        .collection("ZTVALUES")
        .findOne({ LABELID: parentLabel, VALUEID: parentId });

      if (!parentExists) {
        throw new Error(
          `El ID padre especificado (${parentId}) no existe en la colección ZTVALUES como ${parentLabel}.`
        );
      }
    }

    // Crear el nuevo objeto ZTVALUES
    const newZTValue = {
      COMPANYID: COMPANYID || null,
      CEDIID: CEDIID || null,
      LABELID: LABELID || "",
      VALUEPAID: VALUEPAID || "",
      VALUEID: VALUEID || "",
      VALUE: VALUE || "",
      ALIAS: ALIAS || "",
      SEQUENCE: SEQUENCE || 0,
      IMAGE: IMAGE || "",
      VALUESAPID: VALUESAPID || "",
      DESCRIPTION: DESCRIPTION || "",
      ROUTE: ROUTE || "",
      DETAIL_ROW: {
        ACTIVED,
        DELETED,
        DETAIL_ROW_REG: detailRowReg,
      },
    };

    // Inserción del nuevo documento
    const result = await mongoose.connection
      .collection("ZTVALUES")
      .insertOne(newZTValue);

    return {
      message: "ZTValue creado exitosamente",
      ztvalueId: result.insertedId,
    };
  } catch (error) {
    console.error("Error al crear el ZTValue:", error.message);
    throw error;
  }
}

// Servicio para actualizar un registro de ZTVALUES
async function UpdateValue(req) {
  try {
    // Obtener VALUEID desde los query parameters
    const { valueid } = req?.req?.query;

    if (!valueid) {
      throw new Error(
        "El parámetro VALUEID es obligatorio para realizar la actualización."
      );
    }

    // Desestructuración de las propiedades del body
    const {
      LABELID,
      VALUEPAID,
      VALUE,
      ALIAS,
      SEQUENCE,
      IMAGE,
      VALUESAPID,
      DESCRIPTION,
      ROUTE,
      ACTIVED,
      DELETED,
      reguser,
    } = req?.req?.body?.values || {};

    const currentDate = new Date();

    // Consultar el registro actual basado en VALUEID
    const existingRecord = await mongoose.connection
      .collection("ZTVALUES")
      .findOne({ VALUEID: valueid });

    if (!existingRecord) {
      throw new Error(`No se encontró un registro con el VALUEID: ${valueid}`);
    }

    // Obtener LABELID actual del registro si no se proporciona en el body
    const currentLabelId = LABELID || existingRecord.LABELID;

    // Validaciones (similar a CreateValue)
    const validLabels = [
      "IdApplications",
      "IdViews",
      "IdProcesses",
      "IdRoles",
      "IdPrivileges",
    ];

    if (!validLabels.includes(currentLabelId)) {
      throw new Error(
        `LABELID debe ser uno de los siguientes: ${validLabels.join(", ")}`
      );
    }

    if (currentLabelId === "IdApplications" && VALUEPAID) {
      throw new Error(
        "VALUEPAID debe estar vacío cuando LABELID es IdApplications, ya que no tiene padre."
      );
    }

    if (currentLabelId !== "IdApplications" && VALUEPAID) {
      const labelIndex = validLabels.indexOf(currentLabelId);
      const parentLabel = validLabels[labelIndex - 1]; // El padre del LABELID actual

      // Verificar el formato de VALUEPAID (sin espacios alrededor del guion)
      const regex = new RegExp(`^${parentLabel}-[A-Za-z0-9]+$`);
      if (!regex.test(VALUEPAID)) {
        throw new Error(
          `VALUEPAID debe estar en el formato "${parentLabel}-<IdRegistro>" sin espacios alrededor del guion.`
        );
      }

      // Verificar la existencia del ID padre en la colección
      const parentId = VALUEPAID.split("-")[1];
      const parentExists = await mongoose.connection
        .collection("ZTVALUES")
        .findOne({ LABELID: parentLabel, VALUEID: parentId });

      if (!parentExists) {
        throw new Error(
          `El ID padre especificado (${parentId}) no existe en la colección ZTVALUES como ${parentLabel}.`
        );
      }
    }

    // Construcción dinámica del objeto de actualización
    const updateFields = {};
    if (LABELID) updateFields.LABELID = LABELID;
    if (VALUEPAID) updateFields.VALUEPAID = VALUEPAID;
    if (VALUE) updateFields.VALUE = VALUE;
    if (ALIAS) updateFields.ALIAS = ALIAS;
    if (SEQUENCE !== undefined) updateFields.SEQUENCE = SEQUENCE;
    if (IMAGE) updateFields.IMAGE = IMAGE;
    if (VALUESAPID) updateFields.VALUESAPID = VALUESAPID;
    if (DESCRIPTION) updateFields.DESCRIPTION = DESCRIPTION;
    if (ROUTE) updateFields.ROUTE = ROUTE;
    if (ACTIVED !== undefined) updateFields["DETAIL_ROW.ACTIVED"] = ACTIVED;
    if (DELETED !== undefined) updateFields["DETAIL_ROW.DELETED"] = DELETED;

    updateFields["DETAIL_ROW_REG"] = [
      {
        CURRENT: false,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser || "",
      },
      {
        CURRENT: true,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser || "",
      },
    ];

    // Realizar la actualización en la colección
    const result = await mongoose.connection
      .collection("ZTVALUES")
      .updateOne({ VALUEID: valueid }, { $set: updateFields });

    if (result.modifiedCount === 0) {
      throw new Error(
        "No se encontró el registro con el VALUEID proporcionado o no se realizó la actualización."
      );
    }

    return {
      message: "ZTValue actualizado exitosamente",
      updatedFields: updateFields,
    };
  } catch (error) {
    console.error("Error al actualizar el ZTValue:", error.message);
    throw error;
  }
}

// Obtener información de roles de usuarios
// Servicio para obtener usuarios con sus roles
async function GetUserRoles(req) {
  try {
    // Eliminar la búsqueda por 'userid' para obtener todos los usuarios
    const pipeline = [
      { $unwind: "$ROLES" },
      {
        $lookup: {
          from: "ZTROLES",
          localField: "ROLES.ROLEID",
          foreignField: "ROLEID",
          as: "roleDetail",
        },
      },
      {
        $addFields: {
          roleInfo: {
            ROLEID: "$ROLES.ROLEID",
            ROLENAME: { $arrayElemAt: ["$roleDetail.ROLENAME", 0] },
            DESCRIPTION: { $arrayElemAt: ["$roleDetail.DESCRIPTION", 0] },
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          userData: { $first: "$$ROOT" },
          roles: { $push: "$roleInfo" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$userData", { ROLES: "$roles" }],
          },
        },
      },
      {
        $project: {
          roleDetail: 0,
          roleInfo: 0,
          "userData.ROLES": 0,
        },
      },
    ];

    const result = await mongoose.connection
      .collection("ZTUSERS")
      .aggregate(pipeline)
      .toArray();

    return result;
  } catch (error) {
    console.error("Error al obtener roles de los usuarios:", error.message);
    throw error;
  }
}

async function GetRoles(req) {
  try {
    let result;

    const roleid = req?.req?.query?.roleid;

    const pipeline = [
      {
        $lookup: {
          from: "ZTROLES",
          localField: "ROLEID",
          foreignField: "ROLEID",
          as: "ROLE_DETAILS",
        },
      },
      { $unwind: "$ROLE_DETAILS" },
      { $unwind: "$ROLE_DETAILS.PRIVILEGES" }, // Desestructurar los privilegios para procesarlos individualmente
      {
        $lookup: {
          from: "ZTVALUES",
          let: { processId: "$ROLE_DETAILS.PRIVILEGES.PROCESSID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $concat: ["IdProcess-", "$VALUEID"] }, "$$processId"],
                },
              },
            },
            {
              $lookup: {
                from: "ZTVALUES",
                let: { viewId: "$VALUEPAID" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: [
                          { $concat: ["IdViews-", "$VALUEID"] },
                          "$$viewId",
                        ],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "ZTVALUES",
                      let: { appId: "$VALUEPAID" },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $eq: [
                                { $concat: ["IdApplications-", "$VALUEID"] },
                                "$$appId",
                              ],
                            },
                          },
                        },
                      ],
                      as: "applicationDetails",
                    },
                  },
                  {
                    $addFields: {
                      applicationInfo: {
                        $arrayElemAt: ["$applicationDetails", 0],
                      },
                    },
                  },
                ],
                as: "viewDetails",
              },
            },
            {
              $addFields: {
                viewInfo: { $arrayElemAt: ["$viewDetails", 0] },
              },
            },
          ],
          as: "processDetails",
        },
      },
      {
        $addFields: {
          processInfo: { $arrayElemAt: ["$processDetails", 0] },
        },
      },
      {
        $group: {
          _id: "$ROLEID",
          ROLEID: { $first: "$ROLEID" },
          ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
          DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
          PROCESSES: {
            $push: {
              PROCESSID: "$ROLE_DETAILS.PRIVILEGES.PROCESSID",
              PROCESSNAME: "$processInfo.VALUE",
              VIEWID: "$processInfo.viewInfo.VALUEID",
              VIEWNAME: "$processInfo.viewInfo.VALUE",
              APPLICATIONID: "$processInfo.viewInfo.applicationInfo.VALUEID",
              APPLICATIONNAME: "$processInfo.viewInfo.applicationInfo.VALUE",
              PRIVILEGES: {
                $map: {
                  input: "$ROLE_DETAILS.PRIVILEGES.PRIVILEGEID",
                  as: "privId",
                  in: {
                    PRIVILEGEID: "$$privId",
                    PRIVILEGENAME: "$$privId", // Asumiendo que el nombre del privilegio es el mismo que su ID
                  },
                },
              },
            },
          },
          DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
        },
      },
      {
        $project: {
          _id: 0,
          ROLEID: 1,
          ROLENAME: 1,
          DESCRIPTION: 1,
          PROCESSES: 1,
          DETAIL_ROW: 1,
        },
      },
    ];

    if (roleid) {
      pipeline.unshift({ $match: { ROLEID: roleid } });
    }

    result = await mongoose.connection
      .collection("ZTROLES")
      .aggregate(pipeline)
      .toArray();
    return result;
  } catch (error) {
    console.error("Error en la agregación de roles:", error.message);
    throw error;
  }
}

async function CreateRole(req) {
  try {
    const {
      ROLEID,
      ROLENAME,
      DESCRIPTION,
      PRIVILEGES,
      ACTIVED = true,
      DELETED = false,
      reguser,
    } = req.data.roles;

    if (!ROLEID || !ROLENAME || !Array.isArray(PRIVILEGES)) {
      return req.error(400, "Datos incompletos o inválidos");
    }

    const exists = await mongoose.connection
      .collection("ZTROLES")
      .findOne({ ROLEID });

    if (exists) {
      return req.error(409, `Ya existe un rol con el ID ${ROLEID}`);
    }

    const currentDate = new Date();

    // Sección para DETAIL_ROW_REG
    const detailRow = [
      {
        CURRENT: false,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
      {
        CURRENT: true,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
    ];
    const newRole = {
      ROLEID,
      ROLENAME,
      DESCRIPTION: DESCRIPTION || "",
      PRIVILEGES,
      DETAIL_ROW: {
        ACTIVED,
        DELETED,
        DETAIL_ROW_REG: detailRow,
      },
    };

    await mongoose.connection.collection("ZTROLES").insertOne(newRole);

    return { message: "Rol creado exitosamente", role: newRole };
  } catch (error) {
    console.error("Error al crear el rol:", error.message);
    return req.error(500, "Error interno del servidor");
  }
}

async function UpdateRole(req) {
  try {
    const { ROLEID, ROLENAME, DESCRIPTION, PRIVILEGES, DETAIL_ROW } =
      req.data.roles;

    if (!ROLEID) {
      return req.error(400, "El campo ROLEID es obligatorio para actualizar");
    }

    const collection = mongoose.connection.collection("ZTROLES");

    const exists = await collection.findOne({ ROLEID });

    if (!exists) {
      return req.error(404, `No se encontró un rol con el ID ${ROLEID}`);
    }

    const updatedFields = {
      ...(ROLENAME && { ROLENAME }),
      ...(DESCRIPTION && { DESCRIPTION }),
      ...(Array.isArray(PRIVILEGES) && { PRIVILEGES }),
      ...(Array.isArray(DETAIL_ROW) && { DETAIL_ROW }),
    };

    if (Object.keys(updatedFields).length === 0) {
      return req.error(400, "No se proporcionaron campos para actualizar");
    }

    await collection.
  e({ ROLEID }, { $set: updatedFields });

    const updatedRole = await collection.findOne({ ROLEID });

    return {
      message: "Rol actualizado exitosamente",
      role: updatedRole,
    };
  } catch (error) {
    console.error("Error al actualizar el rol:", error.message);
    return req.error(500, "Error interno del servidor");
  }
}

module.exports = {
  GetLabelsWithValues,
  GetUserInfo,
  CreateUser,
  DeleteRecord,
  CreateValue,
  UpdateValue,
  updateoneuser,
  GetUserRoles,
  GetRoles,
  CreateRole,
  UpdateRole,

};

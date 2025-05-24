//Import libraries

const cds = require("@sap/cds");

const {
  crudSimulation,
  crudStrategies,
  company,
  strategy,
  priceshistory,
  simulation,
  reversionSimple,
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

    this.on("strategy", async (req) => {
      try {
        return await strategy(req);
      } catch (error) {
        req.error(400, error.message || "Error en strategy");
      }
    });

    this.on("priceshistory", async (req) => {
      try {
        return await priceshistory(req);
      } catch (error) {
        req.error(400, error.message || "Error en indicators");
      }
    });

    this.on("simulation", async (req) => {
      try {
        // Extraer 'strategy' de los query params y datos del body
        // Asegúrate de que 'req.req.query' y 'req.req.body.simulation' son las rutas correctas
        // para acceder a estos datos en tu entorno CDS.
        const { strategy } = req?.req?.query || {};
        const body = req?.req?.body?.SIMULATION || {}; // Aquí está todo el body

        console.log(body); // Esto mostrará el objeto JavaScript de la solicitud

        // Validaciones
        if (!strategy) {
          throw new Error(
            "Falta el parámetro requerido: 'strategy' en los query parameters."
          );
        }
        if (Object.keys(body).length === 0) {
          throw new Error(
            "El cuerpo de la solicitud no puede estar vacío. Se esperan parámetros de simulación."
          );
        }

        // Switch para manejar diferentes estrategias
        switch (strategy.toLowerCase()) {
          case "reversionsimple":
            // Llama a la función reversionSimple con el objeto 'body' directamente.
            // 'reversionSimple' ya devuelve un objeto JavaScript.
            const result = await reversionSimple(body);
            // NO uses JSON.parse(result) aquí, porque 'result' ya es un objeto.
            // El framework se encargará de serializarlo a JSON para la respuesta HTTP.
            return result; // <-- ¡Esta es la corrección clave!

          // Aquí puedes agregar más estrategias en el futuro:
          // case 'otraEstrategia':
          //   return await otraFuncionDeEstrategia(body);

          default:
            throw new Error(`Estrategia no reconocida: ${strategy}`);
        }
      } catch (error) {
        console.error("Error en el controlador de simulación:", error);
        // Retorna un objeto de error que el framework pueda serializar a JSON.
        return {
          ERROR: true,
          MESSAGE:
            error.message || "Error al procesar la solicitud de simulación.",
        };
      }
    });
    return await super.init();
  } //cierre init
} //fin de la clase

// Export the controller class
module.exports = InversionsClass;

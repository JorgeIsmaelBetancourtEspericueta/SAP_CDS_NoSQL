const mongoose = require("mongoose");
const axios = require("axios");

async function crudSimulation(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get": // Obtener los registros
        try {
          let result;
          const strategie = req?.req?.query?.strategie;
          const strategieid = req?.req?.query?.id;

          const baseFilter = { "DETAIL_ROW.ACTIVED": true };

          if (strategie) {
            // Buscar simulaciones por nombre de estrategia
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, STRATEGY_NAME: strategie })
              .toArray();
          } else if (strategieid) {
            // Buscar simulaciones por ID de estrategia
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, SIMULATION_ID: strategieid })
              .toArray();
          } else {
            // Obtener todas las simulaciones activas
            result = await mongoose.connection
              .collection("SIMULATION")
              .find(baseFilter)
              .toArray();
          }

          return result;
        } catch (error) {
          console.error("Error al obtener simulaciones:", error);
          throw new Error("Error al obtener simulaciones");
        }

      case "delete": // Eliminar una simulación
        try {
          const { id, borrado } = req?.req?.query || {};

          if (!id) {
            throw new Error(
              "Se debe proporcionar el ID de la simulación a eliminar"
            );
          }

          const filter = { SIMULATION_ID: id };

          if (borrado === "fisic") {
            // Eliminación física
            const updateFields = {
              "DETAIL_ROW.$[].ACTIVED": false,
              "DETAIL_ROW.$[].DELETED": true,
            };

            const result = await mongoose.connection
              .collection("SIMULATION")
              .updateOne(filter, { $set: updateFields });

            if (result.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la simulación");
            }

            return { message: "Simulación marcada como eliminada físicamente" };
          } else {
            // Eliminación lógica
            const updateFields = {
              "DETAIL_ROW.$[].ACTIVED": false,
              "DETAIL_ROW.$[].DELETED": false,
            };

            const result = await mongoose.connection
              .collection("SIMULATION")
              .updateOne(filter, { $set: updateFields });

            if (result.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la simulación");
            }

            return { message: "Simulación marcada como eliminada lógicamente" };
          }
        } catch (error) {
          console.error("Error al eliminar simulación:", error);
          throw new Error("Error al eliminar simulación");
        }
      case "post":
        try {
          const { symbol, initial_investment, simulationName } =
            req?.req?.query || {};

          if (!symbol || !initial_investment || !simulationName) {
            throw new Error(
              "Faltan parámetros requeridos: 'symbol', 'initial_investment', 'simulationName'."
            );
          }

          const idUser = "USER_TEST";

          switch (simulationName) {
            case "ReversionSimple":
              const apiKey = "demo";
              const apiUrl = `https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${apiKey}`;
              const response = await axios.get(apiUrl);
              const optionsData = response.data?.data;
              const idStrategy = "STRATEGY_001";

              if (!optionsData || optionsData.length === 0) {
                throw new Error(
                  "No se encontraron datos de opciones históricas."
                );
              }

              const validOptions = optionsData.filter((option) => {
                return (
                  option.type === "call" &&
                  parseFloat(option.mark) > 0 &&
                  new Date(option.expiration) > new Date()
                );
              });

              if (validOptions.length === 0) {
                throw new Error(
                  "No hay suficientes datos válidos para calcular la estrategia."
                );
              }

              const markPricesByExpirationDate = {};
              for (const option of validOptions) {
                const { expiration, mark } = option;
                if (!markPricesByExpirationDate[expiration])
                  markPricesByExpirationDate[expiration] = [];
                markPricesByExpirationDate[expiration].push(parseFloat(mark));
              }

              const expirationDates = Object.keys(
                markPricesByExpirationDate
              ).sort();
              const prices = expirationDates.map((date) => {
                const values = markPricesByExpirationDate[date];
                const avgPrice =
                  values.reduce((sum, p) => sum + p, 0) / values.length;
                return { date, close: avgPrice };
              });

              if (prices.length < 5) {
                throw new Error(
                  "No hay suficientes datos para calcular la estrategia."
                );
              }

              const smaPeriod = Math.min(5, prices.length);
              const smaValues = prices.map((_, i, arr) => {
                if (i < smaPeriod - 1) return null;
                const sum = arr
                  .slice(i - smaPeriod + 1, i + 1)
                  .reduce((acc, val) => acc + val.close, 0);
                return sum / smaPeriod;
              });

              let entryPrice = null,
                exitPrice = null,
                entryDate = null,
                exitDate = null;
              for (let i = smaPeriod; i < prices.length; i++) {
                const price = prices[i].close;
                const sma = smaValues[i];
                if (!sma) continue;
                if (!entryPrice && price < sma * 0.95) {
                  entryPrice = price;
                  entryDate = prices[i].date;
                } else if (entryPrice && price > sma * 1.05) {
                  exitPrice = price;
                  exitDate = prices[i].date;
                  break;
                }
              }

              if (!entryPrice || !exitPrice) {
                throw new Error(
                  "No se identificaron puntos válidos de entrada/salida."
                );
              }

              // NUEVO CÁLCULO AJUSTADO
              const investment = parseFloat(initial_investment);
              const unitsBought = investment / entryPrice;
              const totalExitValue = unitsBought * exitPrice;
              const totalProfit = totalExitValue - investment;
              const returnPercentage = totalProfit / investment;

              const recentPrices = prices.slice(-smaPeriod);
              const priceChanges = recentPrices
                .map((v, i, arr) => (i === 0 ? 0 : v.close - arr[i - 1].close))
                .slice(1);
              const avgChange =
                priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
              const volatility =
                priceChanges.reduce(
                  (a, b) => a + Math.pow(b - avgChange, 2),
                  0
                ) / priceChanges.length;

              const trend =
                avgChange > 0
                  ? "bullish"
                  : avgChange < 0
                  ? "bearish"
                  : "sideways";
              const volatilityLevel =
                volatility > 2 ? "high" : volatility > 1 ? "medium" : "low";

              const simulation = {
                idSimulation: `SIM_${Date.now()}`,
                idUser,
                idStrategy,
                simulationName,
                symbol,
                startDate: new Date(entryDate),
                endDate: new Date(exitDate),
                amount: investment,
                specs: `Trend: ${trend}, Volatility: ${volatilityLevel}`,
                result: parseFloat(totalProfit.toFixed(2)),
                percentageReturn: parseFloat(
                  (returnPercentage * 100).toFixed(2)
                ),
                signals: [
                  {
                    date: new Date(entryDate),
                    type: "BUY",
                    price: entryPrice,
                    reasoning: "Precio por debajo del 95% del SMA",
                  },
                  {
                    date: new Date(exitDate),
                    type: "SELL",
                    price: exitPrice,
                    reasoning: "Precio por encima del 105% del SMA",
                  },
                ],
                DETAIL_ROW: [
                  {
                    ACTIVED: true,
                    DELETED: false,
                    DETAIL_ROW_REG: [
                      {
                        CURRENT: true,
                        REGDATE: new Date(),
                        REGTIME: new Date(),
                        REGUSER: "FIBARRAC",
                      },
                    ],
                  },
                ],
              };

              await mongoose.connection
                .collection("SIMULATION")
                .insertOne(simulation);
              return { message: "Simulación creada exitosamente.", simulation };
          }
        } catch (error) {
          console.error("Error detallado:", error.message || error);
          throw new Error(
            `Error al crear la simulación: ${error.message || error}`
          );
        }

      case "update":
        try {
          const { id } = req?.req?.query || {};
          const simulation = req?.data?.simulation;

          if (!id) {
            throw new Error(
              "Se debe proporcionar el ID de la simulación a actualizar en query (param 'id')."
            );
          }

          if (!simulation?.simulationName) {
            throw new Error(
              "Se debe proporcionar un nuevo nombre para la simulación en 'simulation.simulationName'."
            );
          }

          const result = await mongoose.connection
            .collection("SIMULATION")
            .findOneAndUpdate(
              { idSimulation: id },
              {
                $set: {
                  simulationName: simulation.simulationName,
                },
              },
              {
                returnDocument: "after", // o "after" si estás usando MongoDB v4.2+
              }
            );

          console.log(result, result.value)
          // Si no se encontró documento
          if (!result) {
            // return plano, sin anidar para evitar que lo envuelvan doblemente
            return {
              "@odata.context": "$metadata#entsimulation",
              message: `No existe simulación con ID ${id}`,
            };
          }

          // Solo regresa una vez la estructura deseada, sin value adicional
          return {
            "@odata.context": "$metadata#entsimulation",
            message: "Nombre de simulación actualizado exitosamente.",
            simulation: result.value,
          };
        } catch (err) {
          console.error("Error al actualizar simulación:", err.message || err);
          throw new Error(
            `Error en UPDATE de simulación: ${err.message || err}`
          );
        }

      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  } catch (error) {
    console.error("Error en crudSimulation:", error.message);
    throw error;
  }
}

const connectToMongoDB = require("../../lib/mongo");
const Strategy = require("../models/mongoDB/strategy");

async function crudStrategies(req) {
  try {
    const action = req.req.query.action;
    if (!action) throw new Error("El parámetro 'action' es obligatorio.");

    await connectToMongoDB(); // conecta a Mongo

    switch (action) {
      case "get":
        try {
          const { id } = req?.req?.query || {};
          //  Si tenemos un ID, buscamos la estrategia por ID
          if (id) {
            const strategy = await Strategy.findOne({
              ID: id,
              "DETAIL_ROW.ACTIVED": true,
              "DETAIL_ROW.DELETED": false,
            });

            if (!strategy) {
              return req.error(
                404,
                `No se encontró estrategia activa con ID '${id}'.`
              );
            }

            return strategy.toObject();
          }
          // Si no tenemos ID, buscamos todas las estrategias activas
          else {
            // Filtramos las estrategias activas
            const strategies = await Strategy.find({
              "DETAIL_ROW.ACTIVED": true,
              "DETAIL_ROW.DELETED": false,
            });

            return strategies.map((s) => s.toObject());
          }
        } catch (error) {
          console.error("Error en getStrategy:", error.message);
          return req.error(
            500,
            `Error al obtener estrategia(s): ${error.message}`
          );
        }

      case "post":
        try {
          const strategyData = req.data?.strategy;
          const strategyID = strategyData?.ID;

          if (!strategyID) {
            return req.error(400, "Se requiere un ID.");
          }

          const existing = await Strategy.findOne({ ID: strategyID });
          if (existing) {
            return req.error(
              409,
              `Ya existe una estrategia con ID '${strategyID}'.`
            );
          }

          const newStrategy = new Strategy({
            ...strategyData,
            DETAIL_ROW: {
              ACTIVED: true,
              DELETED: false,
              DETAIL_ROW_REG: [
                {
                  CURRENT: true,
                  REGDATE: new Date(),
                  REGTIME: new Date(),
                  REGUSER: "FIBARRAC",
                },
              ],
            },
          });

          await newStrategy.save();

          return {
            message: "Estrategia creada correctamente.",
            strategy: newStrategy.toObject(),
          };
        } catch (error) {
          console.error("Error en postStrategy:", error.message);
          return req.error(500, `Error al crear estrategia: ${error.message}`);
        }
      case "update":
        try {
          const { id } = req?.req?.query || {};
          const strategyData = req.data?.strategy;

          if (!id) {
            return req.error(
              400,
              "Se debe proporcionar el ID de la estrategia en query (param 'id')."
            );
          }
          if (!strategyData) {
            return req.error(
              400,
              "Se debe proporcionar en el body un objeto 'strategy'."
            );
          }

          const updates = { ...strategyData };
          delete updates.ID;

          if (Object.keys(updates).length === 0) {
            return req.error(
              400,
              "Debe especificar al menos un campo distinto de 'ID' para actualizar."
            );
          }

          const existing = await Strategy.findOne({ ID: id });
          if (!existing) {
            return req.error(404, `No se encontró estrategia con ID '${id}'.`);
          }

          Object.assign(existing, updates);

          existing.DETAIL_ROW = existing.DETAIL_ROW || {
            ACTIVED: true,
            DELETED: false,
            DETAIL_ROW_REG: [],
          };
          existing.DETAIL_ROW.DETAIL_ROW_REG.push({
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: "FIBARRAC",
          });

          await existing.save();
          return {
            message: "Estrategia actualizada correctamente.",
            strategy: existing.toObject(),
          };
        } catch (error) {
          console.error("Error en patchStrategy:", error.message);
          return req.error(
            500,
            `Error al actualizar estrategia: ${error.message}`
          );
        }

      case "delete":
        try {
          const { id, borrado } = req?.req?.query || {};

          if (!id) {
            return req.error(
              400,
              "Se debe proporcionar el ID de la estrategia en query (param 'id')."
            );
          }

          const strategy = await Strategy.findOne({ ID: id });

          if (!strategy) {
            return req.error(404, `No se encontró estrategia con ID '${id}'.`);
          }

          // Estructura base de DETAIL_ROW si no existe
          strategy.DETAIL_ROW = strategy.DETAIL_ROW || {
            ACTIVED: true,
            DELETED: false,
            DETAIL_ROW_REG: [],
          };

          // Marcar eliminación según el tipo
          if (borrado === "fisic") {
            // Borrado físico
            strategy.DETAIL_ROW.ACTIVED = false;
            strategy.DETAIL_ROW.DELETED = true;
          } else {
            // Borrado lógico
            strategy.DETAIL_ROW.ACTIVED = false;
            strategy.DETAIL_ROW.DELETED = false;
          }

          // Registrar cambio
          strategy.DETAIL_ROW.DETAIL_ROW_REG.push({
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: "FIBARRAC",
          });

          await strategy.save();

          return {
            message: `Estrategia con ID '${id}' marcada como eliminada ${
              borrado === "fisic" ? "físicamente" : "lógicamente"
            }.`,
            strategy: strategy.toObject(),
          };
        } catch (error) {
          console.error("Error en deleteStrategy:", error.message);
          return req.error(
            500,
            `Error al eliminar estrategia: ${error.message}`
          );
        }

      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  } catch (error) {
    console.error("Error en crudStrategies:", error.message);
    throw error;
  }
}

module.exports = { crudSimulation, crudStrategies };

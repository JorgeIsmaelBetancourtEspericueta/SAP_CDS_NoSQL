const mongoose = require("mongoose");
const axios = require("axios");

async function crudSimulation(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get":
        try {
          let result;

          const simulationId = req?.req?.query?.idSimulation;
          const simulation = req?.req?.query?.simulationName;
          const strategieid = req?.req?.query?.idStrategy;

          const baseFilter = { "DETAIL_ROW.ACTIVED": true };

          if (simulationId) {
            result = await mongoose.connection

              .collection("SIMULATION")
              .find({ ...baseFilter, idSimulation: simulationId })
              .toArray();
              console.log("1")
          } else if (simulation) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, simulationName: simulation })
              .toArray();
              console.log("2")
          } else if (strategieid) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, idStrategy: strategieid })
              .toArray();
              console.log("3")
          } else {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find(baseFilter)
              .toArray();
              console.log("4")
          }
          
          return result;
        } catch (error) {
          console.error("Error al obtener simulaciones:", error);
          throw new Error("Error al obtener simulaciones");
        }

      case "delete":
        try {
          const { id, borrado } = req?.req?.query || {};
          const idUser = "USER_TEST";

          // Validación
          if (!id) {
            throw new Error(
              "Se debe proporcionar el ID de la simulación a eliminar"
            );
          }

          const filter = { idSimulation: id };
          const collection = mongoose.connection.collection("SIMULATION");

          // Comprobar existencia
          const existing = await collection.findOne(filter);
          if (!existing) {
            throw new Error(`No existe simulación con idSimulation=${id}`);
          }

          // Comprobar estado previo
          const dr = existing.DETAIL_ROW;
          if (dr?.DELETED === true && dr?.ACTIVED === false) {
            throw new Error(
              "La simulación ya fue eliminada lógicamente anteriormente"
            );
          }

          // Registro de auditoría
          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };

          if (borrado === "fisic") {
            // Borrado físico: eliminamos todo el documento
            const delRes = await collection.deleteOne(filter);
            if (delRes.deletedCount === 0) {
              throw new Error("No se pudo eliminar físicamente la simulación");
            }
            return { message: "Simulación eliminada físicamente" };
          } else {
            // Borrado lógico: seteamos flags y push al historial
            await collection.updateOne(filter, {
              $set: { "DETAIL_ROW.0.DETAIL_ROW_REG.$[].CURRENT": false },
            });

            const updRes = await collection.updateOne(filter, {
              $set: {
                "DETAIL_ROW.0.ACTIVED": false,
                "DETAIL_ROW.0.DELETED": true,
              },
              $push: {
                "DETAIL_ROW.0.DETAIL_ROW_REG": regEntry,
              },
            });

            if (updRes.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la simulación");
            }
            return { message: "Simulación marcada como eliminada lógicamente" };
          }
        } catch (error) {
          console.error(
            "Error al eliminar simulación:",
            error.message || error
          );
          throw {
            code: 400,
            message: error.message || "Error al eliminar simulación",
            "@Common.numericSeverity": 4,
          };
        }

      case "post":
        try {
          const {
            symbol,
            initial_investment,
            simulationName,
            startDate,
            endDate,
            rsiPeriod = 14,
          } = req?.req?.query || {};

          if (
            !symbol ||
            !initial_investment ||
            !simulationName ||
            !startDate ||
            !endDate
          ) {
            throw new Error(
              "Faltan parámetros requeridos: 'symbol', 'initial_investment', 'simulationName', 'startDate', 'endDate'."
            );
          }

          const idUser = "USER_TEST";
          const idStrategy = "STRATEGY_001";

          switch (simulationName) {
            case "ReversionSimple":
              const apiKey = "demo"; // Reemplaza con tu API key
              const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
              const response = await axios.get(apiUrl);
              const optionsData = response.data["Time Series (Daily)"];

              if (!optionsData || Object.keys(optionsData).length === 0) {
                throw new Error(
                  "No se encontraron datos de precios históricos."
                );
              }

              const smaPeriod = 5;
              const rsiPeriod = 14;
              const bufferDays = Math.max(smaPeriod, rsiPeriod);

              const allDatesSorted = Object.keys(optionsData).sort(
                (a, b) => new Date(a) - new Date(b)
              );

              const extendedStartIndex =
                allDatesSorted.findIndex((date) => date >= startDate) -
                bufferDays;

              const adjustedStartIndex =
                extendedStartIndex >= 0 ? extendedStartIndex : 0;

              const filteredPrices = allDatesSorted
                .slice(adjustedStartIndex)
                .filter((date) => date <= endDate)
                .map((date) => ({
                  date,
                  open: parseFloat(optionsData[date]["1. open"]),
                  high: parseFloat(optionsData[date]["2. high"]),
                  low: parseFloat(optionsData[date]["3. low"]),
                  close: parseFloat(optionsData[date]["4. close"]),
                  volume: parseFloat(optionsData[date]["5. volume"]),
                }));

              if (filteredPrices.length < bufferDays) {
                throw new Error(
                  "No hay suficientes datos para calcular la estrategia."
                );
              }

              const smaValues = filteredPrices.map((_, i, arr) => {
                if (i < smaPeriod - 1) return null;
                const sum = arr
                  .slice(i - smaPeriod + 1, i + 1)
                  .reduce((acc, val) => acc + val.close, 0);
                return sum / smaPeriod;
              });

              const rsiValues = [];
              for (let i = 0; i < filteredPrices.length; i++) {
                if (i < rsiPeriod) {
                  rsiValues.push(null);
                  continue;
                }

                let gains = 0,
                  losses = 0;
                for (let j = i - rsiPeriod + 1; j <= i; j++) {
                  const change =
                    filteredPrices[j].close - filteredPrices[j - 1].close;
                  if (change > 0) gains += change;
                  else losses -= change;
                }

                const avgGain = gains / rsiPeriod;
                const avgLoss = losses / rsiPeriod;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                const rsi = 100 - 100 / (1 + rs);
                rsiValues.push(parseFloat(rsi.toFixed(2)));
              }

              const signals = [];
              let unitsHeld = 0;
              let cash = parseFloat(initial_investment);
              let totalBoughtUnits = 0;
              let totalSoldUnits = 0;
              const boughtPrices = [];
              let totalRealProfit = 0; // Ganancia real acumulada

              const pricesHistory = [];
              const chartData = []; // Inicializamos el array para chart_data

              for (let i = 0; i < filteredPrices.length; i++) {
                const {
                  date,
                  open,
                  high,
                  low,
                  close: price,
                  volume,
                } = filteredPrices[i];
                if (date < startDate) continue;

                const sma = smaValues[i];
                const rsi = rsiValues[i];

                const dailySignal = {
                  date,
                  price,
                  sma: sma !== null ? parseFloat(sma.toFixed(2)) : null,
                  rsi: rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
                  calculation: "",
                  signal: null,
                  reasoning: null,
                  holding: unitsHeld > 0,
                  unitsBought: 0,
                  unitsSold: 0,
                  cashBefore: parseFloat(cash.toFixed(2)),
                  cashAfter: null,
                  unitsHeldAfter: null,
                  spent: 0,
                  earned: 0,
                  purchasePrice: null,
                  sellingPrice: null,
                  realProfit: 0, // Ganancia real del día
                };

                if (price < sma * 0.98 && cash > 0) {
                  const investment = cash * 0.5;
                  const unitsToBuy = investment / price;
                  const spent = unitsToBuy * price;
                  unitsHeld += unitsToBuy;
                  cash -= spent;
                  totalBoughtUnits += unitsToBuy;
                  boughtPrices.push({ date, price, units: unitsToBuy });

                  dailySignal.signal = "COMPRA";
                  dailySignal.reasoning = `El precio está por debajo del 98% del SMA. RSI: ${rsi.toFixed(
                    2
                  )}`;
                  dailySignal.calculation = `${price.toFixed(2)} < ${(
                    sma * 0.98
                  ).toFixed(2)}`;
                  dailySignal.unitsBought = parseFloat(unitsToBuy.toFixed(4));
                  dailySignal.spent = parseFloat(spent.toFixed(2));
                  dailySignal.purchasePrice = parseFloat(price.toFixed(2));
                } else if (price > sma * 1.02 && unitsHeld > 0) {
                  const unitsToSell = unitsHeld * 0.25;
                  const revenue = unitsToSell * price;
                  cash += revenue;
                  unitsHeld -= unitsToSell;
                  totalSoldUnits += unitsToSell;

                  let soldUnitsCounter = unitsToSell;
                  let purchasePricesForSale = [];
                  for (
                    let j = 0;
                    j < boughtPrices.length && soldUnitsCounter > 0;
                    j++
                  ) {
                    const purchase = boughtPrices[j];
                    if (purchase.units <= soldUnitsCounter) {
                      purchasePricesForSale.push(purchase.price);
                      soldUnitsCounter -= purchase.units;
                      boughtPrices.splice(j, 1);
                      j--;
                    } else {
                      purchasePricesForSale.push(purchase.price);
                      boughtPrices[j].units -= soldUnitsCounter;
                      soldUnitsCounter = 0;
                    }
                  }
                  const averagePurchasePrice =
                    purchasePricesForSale.reduce(
                      (sum, price) => sum + price,
                      0
                    ) / purchasePricesForSale.length;
                  const realProfit =
                    (price - averagePurchasePrice) * unitsToSell; // Calcular ganancia real
                  totalRealProfit += realProfit; // Acumular ganancia real

                  dailySignal.signal = "VENTA";
                  dailySignal.reasoning = `El precio está por encima del 102% del SMA. RSI: ${rsi.toFixed(
                    2
                  )}`;
                  dailySignal.calculation = `${price.toFixed(2)} > ${(
                    sma * 1.02
                  ).toFixed(2)}`;
                  dailySignal.unitsSold = parseFloat(unitsToSell.toFixed(4));
                  dailySignal.earned = parseFloat(revenue.toFixed(2));
                  dailySignal.purchasePrice = parseFloat(
                    averagePurchasePrice.toFixed(2)
                  );
                  dailySignal.sellingPrice = parseFloat(price.toFixed(2));
                  dailySignal.realProfit = parseFloat(realProfit.toFixed(2)); // Agregar ganancia real al objeto
                }

                dailySignal.cashAfter = parseFloat(cash.toFixed(2));
                dailySignal.unitsHeldAfter = parseFloat(unitsHeld.toFixed(4));
                signals.push(dailySignal);

                pricesHistory.push({
                  Date: date,
                  Open: open,
                  High: high,
                  Low: low,
                  Close: price,
                  Volume: volume,
                  Indicators:
                    sma !== null && rsi !== null
                      ? `SMA: ${sma.toFixed(2)}, RSI: ${rsi.toFixed(2)}`
                      : "",
                  Signal: dailySignal.signal || "",
                  Rules: dailySignal.reasoning || "",
                  Shares: parseFloat(unitsHeld.toFixed(4)),
                });

                // Agregamos los datos para chart_data, excluyendo "Indicators", "Signals" y "Rules"
                // Agregamos los datos para chart_data, incluyendo el valor del SMA
                chartData.push({
                  Date: date,
                  Open: open,
                  High: high,
                  Low: low,
                  Close: price,
                  Volume: volume,
                  Shares: parseFloat(unitsHeld.toFixed(4)),
                  SMA: sma !== null ? parseFloat(sma.toFixed(2)) : null, // Aquí agregamos el SMA
                });
              }

              const lastPrice = filteredPrices.at(-1).close;
              const finalValue = unitsHeld * lastPrice;
              const finalBalance = cash + finalValue;

              const simulation = {
                idSimulation: `SIM_${Date.now()}`,
                idUser,
                idStrategy,
                simulationName,
                symbol,
                startDate,
                endDate,
                amount: parseFloat(initial_investment),
                specs: `Tendencia: bajista, Volatilidad: alta, Periodo RSI: ${rsiPeriod}`,
                result: parseFloat(
                  (finalBalance - initial_investment).toFixed(2)
                ),
                percentageReturn: parseFloat(
                  (
                    ((finalBalance - initial_investment) / initial_investment) *
                    100
                  ).toFixed(2)
                ),
                summary: {
                  totalBoughtUnits: parseFloat(totalBoughtUnits.toFixed(4)),
                  totalSoldUnits: parseFloat(totalSoldUnits.toFixed(4)),
                  remainingUnits: parseFloat(unitsHeld.toFixed(4)),
                  finalCash: parseFloat(cash.toFixed(2)),
                  finalValue: parseFloat(finalValue.toFixed(2)),
                  finalBalance: parseFloat(finalBalance.toFixed(2)),
                  realProfit: parseFloat(totalRealProfit.toFixed(2)), // Agregar ganancia real al resumen
                },
                signals,
                historicalPrices: pricesHistory,
                chart_data: chartData, // Agregamos el subarreglo chart_data aquí
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

              await mongoose.connection.collection("ZTPRICESHISTORY").updateOne(
                { symbol },
                {
                  $set: { symbol, lastUpdated: new Date() },
                  $addToSet: {
                    prices: {
                      $each: filteredPrices.map(({ date, close }) => ({
                        date,
                        close,
                      })),
                    },
                  },
                },
                { upsert: true }
              );

              return {
                message: "Simulación creada exitosamente.",
                simulation,
              };

            default:
              throw new Error("Estrategia no reconocida.");
          }
        } catch (error) {
          return {
            error: true,
            message: error.message || "Error al procesar la solicitud.",
          };
        }

      case "update":
        try {
          const { id } = req?.req?.query || {};
          const simulation = req?.data?.simulation;
          const idUser = "USER_TEST";
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

          const collection = mongoose.connection.collection("SIMULATION");
          const existing = await collection.findOne({ idSimulation: id });
          if (!existing) {
            return {
              "@odata.context": "$metadata#entsimulation",
              message: `No existe simulación con ID ${id}`,
            };
          }

          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };

          await collection.updateOne(
            { idSimulation: id },
            {
              $set: {
                "DETAIL_ROW.0.DETAIL_ROW_REG.$[].CURRENT": false,
              },
            }
          );

          // 2. Setear nuevo nombre y agregar nueva entrada de auditoría
          const updRes = await collection.updateOne(
            { idSimulation: id },
            {
              $set: {
                simulationName: simulation.simulationName,
              },
              $push: {
                "DETAIL_ROW.0.DETAIL_ROW_REG": regEntry,
              },
            }
          );

          if (updRes.modifiedCount === 0) {
            throw new Error("No se pudo actualizar la simulación");
          }

          const updatedDoc = await collection.findOne({ idSimulation: id });
          return {
            "@odata.context": "$metadata#entsimulation",
            message: "Nombre de simulación actualizado exitosamente.",
            simulation: updatedDoc,
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

async function crudStrategies(req) {
  try {
    const action = req.req.query.action;
    if (!action) throw new Error("El parámetro 'action' es obligatorio.");

    await connectToMongoDB(); // conecta a Mongo
    //get start

    switch (action) {
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
          const idUser = "USER_TEST";

          // 1) Validación
          if (!id) {
            return req.error(
              400,
              "Se debe proporcionar el ID de la estrategia en query (param 'id')."
            );
          }

          const collection = mongoose.connection.collection("STRATEGIES");
          const filter = { ID: id };

          // 2) Buscar documento
          let existing = await collection.findOne(filter);
          if (!existing) {
            return req.error(404, `No se encontró estrategia con ID '${id}'.`);
          }

          // 3) Inicializar DETAIL_ROW si no existe
          if (!existing.DETAIL_ROW) {
            await collection.updateOne(filter, {
              $set: {
                DETAIL_ROW: {
                  ACTIVED: true,
                  DELETED: false,
                  DETAIL_ROW_REG: [],
                },
              },
            });
            existing = await collection.findOne(filter); 
          }

          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };


          if (borrado === "fisic") {
            const delRes = await collection.deleteOne(filter);
            if (delRes.deletedCount === 0) {
              throw new Error("No se pudo eliminar físicamente la estrategia");
            }
            return {
              message: `Estrategia con ID '${id}' eliminada físicamente.`,
            };
          } else {
    
            const dr = existing.DETAIL_ROW;
            if (dr.DELETED === true && dr.ACTIVED === false) {
              return req.error(
                400,
                "La estrategia ya fue eliminada lógicamente anteriormente."
              );
            }

            await collection.updateOne(filter, {
              $set: { "DETAIL_ROW.DETAIL_ROW_REG.$[].CURRENT": false }
            });

            const updRes = await collection.updateOne(filter, {
              $set: {
                "DETAIL_ROW.ACTIVED": false,
                "DETAIL_ROW.DELETED": true,
              },
              $push: {
                "DETAIL_ROW.DETAIL_ROW_REG": regEntry,
              }
            });

            if (updRes.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la estrategia");
            }

            return {
              message: `Estrategia con ID '${id}' marcada como eliminada lógicamente.`,
            };
          }
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

//limit

async function company(req) {
  const Company = require("../models/mongoDB/company.js");
  try {
    // Buscar todas las empresas activas
    const companies = await Company.find({});
    return companies.map((c) => c.toObject());
  } catch (error) {
    console.error("Error en getCompany:", error.message);
    return req.error(500, `Error al obtener empresa(s): ${error.message}`);
  }
}

//Get PricesHistory
async function priceshistory(req) {
  try {
    let result;
    const { idPrice, strategy, productCode } = req?.req?.query || {};

    const collection = mongoose.connection.collection("ZTPRICESHISTORY");

    if (idPrice) {
      result = await collection.find({ idPrice }).toArray();
    } else if (strategy) {
      result = await collection.find({ STRATEGY_NAME: strategy }).toArray();
    } else if (productCode) {
      result = await collection.find({ PRODUCT_CODE: productCode }).toArray();
    } else {
      result = await collection.find({}).toArray();
    }

    return result;
  } catch (error) {
    console.error("Error al obtener registros de ZTPRICESHISTORY:", error);
    throw new Error("Error al obtener registros de ZTPRICESHISTORY");
  }
}

//get strategy
async function strategy(req) {
  const Strategy = require("../models/mongoDB/Strategy.js");

  try {
    // Buscar todas las estrategias activas y no eliminadas
    const strategies = await Strategy.find({
      "DETAIL_ROW.ACTIVED": true,
      "DETAIL_ROW.DELETED": false,
    });

    // Si no se encuentran estrategias, enviar un error 404
    if (strategies.length === 0) {
      return req.error(
        404,
        "No se encontraron estrategias activas y no eliminadas."
      );
    }

    // Si hay estrategias, devolverlas en formato objeto
    return strategies.map((s) => s.toObject());
  } catch (error) {
    console.error("Error en getStrategy:", error.message);
    return req.error(500, `Error al obtener estrategias: ${error.message}`);
  }
}

module.exports = {
  crudSimulation,
  crudStrategies,
  company,
  strategy,
  priceshistory,
};

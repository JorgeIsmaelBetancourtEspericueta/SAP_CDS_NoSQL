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
                    const simulationId  = req?.req?.query?.idSimulation;
                    const simulation    = req?.req?.query?.simulationName;
                    const strategieid   = req?.req?.query?.idStrategy;
                    const symbol        = req?.req?.query?.symbol;
                    //
                    const minBalance = Number(req.req.query.minBalance); // el valor que pasa el usuario

                     

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
          .find({
            ...baseFilter,
            simulationName: { $regex: simulation, $options: "i" } 
          })
          .toArray();


          } else if (strategieid) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, idStrategy: strategieid })
              .toArray();
           

         } else if (minBalance) {
             result = await mongoose.connection
                 .collection("SIMULATION")
                 .find({
                 ...baseFilter,
               "summary.finalBalance": { $gt: Number(minBalance) }
              })
              .toArray();
          }
           
          else if (symbol) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, symbol: symbol })
              .toArray();

         /* } else if (simulationId) {
            const queryStartDateParam = req?.req?.query?.startDate;
            const queryEndDateParam = req?.req?.query?.endDate;
 const pipeline = [
        {
          $match: {
            ...baseFilter,
            idSimulation: simulationId
          }
        },
        {
          $project: {
            idSimulation: 1,
            idUser: 1,
            idStrategy: 1,
            simulationName: 1,
            symbol: 1,
            startDate: 1,
            endDate: 1,
            amount: 1,
            specs: 1,
            result: 1,
            percentageReturn: 1,
            summary: 1,
            DETAIL_ROW: 1,
            signals: {
              $filter: {
                input: "$signals",
                as: "signal",
                cond: {
                  $and: [
                    { $gte: [{ $toDate: "$$signal.date" }, queryStartDateParam] },
                    { $lte: [{ $toDate: "$$signal.date" }, queryEndDateParam] }
                  ]
                }
              }
            }
          }
        }
      ];

      result = await mongoose.connection
        .collection("SIMULATION")
        .aggregate(pipeline)
        .toArray();
*/
    }else {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find(baseFilter)
              .toArray();
            console.log("4");
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
      //crudSimualtion?action=post
      case "post":
        try {
          const {
            symbol,
            initial_investment,
            simulationName,
            startDate,
            endDate,
            rsiPeriod: rsiPeriodFromQuery, // Renombrar para evitar conflicto con la variable local
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
              // Establecer dinámicamente rsiPeriod, por defecto a 14 si no se proporciona o es inválido
              const rsiPeriod = parseInt(rsiPeriodFromQuery) || 14;
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
              // Inicializamos el subdocumento para la última operación como un objeto vacío
              let lastOperation = {};

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

                  // Actualizar lastOperation
                  lastOperation = {
                    type: "COMPRA",
                    price: parseFloat(price.toFixed(2)),
                    reasoning: dailySignal.reasoning,
                  };
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

                  // Actualizar lastOperation
                  lastOperation = {
                    type: "VENTA",
                    price: parseFloat(price.toFixed(2)),
                    reasoning: dailySignal.reasoning,
                  };
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
                lastOperation: lastOperation, // Agregamos el subdocumento de la última operación
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
              $set: { "DETAIL_ROW.DETAIL_ROW_REG.$[].CURRENT": false },
            });

            const updRes = await collection.updateOne(filter, {
              $set: {
                "DETAIL_ROW.ACTIVED": false,
                "DETAIL_ROW.DELETED": true,
              },
              $push: {
                "DETAIL_ROW.DETAIL_ROW_REG": regEntry,
              },
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
    // Buscar todas las estrategias sin aplicar filtros
    const strategies = await Strategy.find();

    // Si no se encuentran estrategias, enviar un error 404
    if (strategies.length === 0) {
      return req.error(404, "No se encontraron estrategias.");
    }

    // Devolver todas las estrategias como objetos
    return strategies.map((s) => s.toObject());
  } catch (error) {
    console.error("Error en getStrategy:", error.message);
    return req.error(500, `Error al obtener estrategias: ${error.message}`);
  }
}

// REVERSION_SIMPLE - La lógica de tu estrategia original, ahora como una función separada
async function reversionSimple(req) {
  
  console.log(req);

  try {
    // Desestructuración de los parámetros requeridos del objeto de solicitud.
    const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = req || {};

    // Validación de la presencia de todos los parámetros esenciales.
    if (!SYMBOL || !STARTDATE || !ENDDATE || AMOUNT === undefined || !USERID) {
      throw new Error(
        "FALTAN PARÁMETROS REQUERIDOS EN EL CUERPO DE LA SOLICITUD: 'SYMBOL', 'STARTDATE', 'ENDDATE', 'AMOUNT', 'USERID'."
      );
    }

    // Genera un ID de simulación único.
    // Usamos Date y Math.random() como alternativa a crypto.randomUUID()
    // si el entorno no soporta Node.js crypto module directamente.
    const generateSimulationId = (symbol) => {
      const date = new Date();
      const timestamp = date.toISOString().replace(/[^0-9]/g, ''); // Formato YYYYMMDDTHHMMSSsssZ
      const random = Math.floor(Math.random() * 10000);
      return `${symbol}_${timestamp}_${random}`;
    };

    const SIMULATIONID = generateSimulationId(SYMBOL);
    const SIMULATIONNAME = "Estrategia de Reversión Simple"; // Nombre de la estrategia
    const STRATEGYID = "IdCM"; // Ajustado a "IdCM" según el formato deseado

    // Extracción de los períodos para RSI y SMA de las especificaciones, con valores por defecto.
    // CORRECCIÓN: Usar 'INDICATOR' en lugar de 'KEY' para encontrar los indicadores.
    const RSI_INDICATOR = SPECS?.find((IND) => IND.INDICATOR?.toLowerCase() === "rsi");
    const SMA_INDICATOR = SPECS?.find((IND) => IND.INDICATOR?.toLowerCase() === "sma");

    const RSI_PERIOD = parseInt(RSI_INDICATOR?.VALUE) || 14;
    const SMA_PERIOD = parseInt(SMA_INDICATOR?.VALUE) || 5;

    // Configuración de la API de Alpha Vantage.
    // Asegúrate de tener 'axios' importado en tu entorno (ej. const axios = require('axios'); o import axios from 'axios';)
    const APIKEY = "demo"; // Clave API de demostración, considera usar una clave real y segura para producción.
    const APIURL = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${APIKEY}`;

    // Realiza la solicitud HTTP para obtener datos históricos.
    const RESPONSE = await axios.get(APIURL);
    const OPTIONSDATA = RESPONSE.data["Time Series (Daily)"];

    // Verifica si se obtuvieron datos históricos.
    if (!OPTIONSDATA || Object.keys(OPTIONSDATA).length === 0) {
      throw new Error(
        "NO SE ENCONTRARON DATOS DE PRECIOS HISTÓRICOS PARA EL SÍMBOLO PROPORCIONADO."
      );
    }

    // Calcula el número de días de "buffer" necesarios para los cálculos de indicadores.
    const BUFFER_DAYS = Math.max(SMA_PERIOD, RSI_PERIOD);

    // Ordena todas las fechas disponibles de los datos históricos.
    const ALL_DATES_SORTED = Object.keys(OPTIONSDATA).sort(
      (A, B) => new Date(A) - new Date(B)
    );

    // Encuentra el índice de inicio ajustado para incluir el buffer de días.
    const EXTENDED_START_INDEX =
      ALL_DATES_SORTED.findIndex((DATE) => DATE >= STARTDATE) - BUFFER_DAYS;

    const ADJUSTED_START_INDEX =
      EXTENDED_START_INDEX >= 0 ? EXTENDED_START_INDEX : 0;

    // Filtra y mapea los precios relevantes para la simulación, incluyendo el buffer.
    const FILTERED_PRICES = ALL_DATES_SORTED.slice(ADJUSTED_START_INDEX)
      .filter((DATE) => DATE <= ENDDATE) // Filtra hasta la fecha de fin
      .map((DATE) => ({
        DATE,
        OPEN: parseFloat(OPTIONSDATA[DATE]["1. open"]),
        HIGH: parseFloat(OPTIONSDATA[DATE]["2. high"]),
        LOW: parseFloat(OPTIONSDATA[DATE]["3. low"]),
        CLOSE: parseFloat(OPTIONSDATA[DATE]["4. close"]),
        VOLUME: parseFloat(OPTIONSDATA[DATE]["5. volume"]),
      }));

    // Verifica si hay suficientes datos para calcular los indicadores.
    if (FILTERED_PRICES.length < BUFFER_DAYS) {
      throw new Error(
        "NO HAY SUFICIENTES DATOS HISTÓRICOS PARA CALCULAR LA ESTRATEGIA CON LOS PERÍODOS ESPECIFICADOS."
      );
    }

    /**
     * Calcula el Simple Moving Average (SMA) para una serie de datos.
     * @param {Array<object>} DATA - Arreglo de objetos de precios con una propiedad 'CLOSE'.
     * @param {number} PERIOD - Período del SMA.
     * @returns {Array<number|null>} - Arreglo de valores SMA o null si no hay suficientes datos.
     */
    const CALCULATE_SMA = (DATA, PERIOD) => {
      const SMA_VALUES = [];
      for (let I = 0; I < DATA.length; I++) {
        if (I < PERIOD - 1) {
          SMA_VALUES.push(null); // No hay suficientes datos para el cálculo inicial
        } else {
          const SUM = DATA.slice(I - PERIOD + 1, I + 1).reduce(
            (ACC, VAL) => ACC + VAL.CLOSE,
            0
          );
          SMA_VALUES.push(SUM / PERIOD);
        }
      }
      return SMA_VALUES;
    };

    // Calcula los valores SMA para los precios filtrados.
    const SMA_VALUES = CALCULATE_SMA(FILTERED_PRICES, SMA_PERIOD);

    // Calcula los valores RSI.
    const RSI_VALUES = [];
    for (let I = 0; I < FILTERED_PRICES.length; I++) {
      if (I < RSI_PERIOD) {
        RSI_VALUES.push(null); // No hay suficientes datos para el cálculo inicial del RSI
        continue;
      }

      let GAINS = 0;
      let LOSSES = 0;
      // Calcula las ganancias y pérdidas para el período RSI.
      for (let J = I - RSI_PERIOD + 1; J <= I; J++) {
        if (J > 0) {
          const CHANGE =
            FILTERED_PRICES[J].CLOSE - FILTERED_PRICES[J - 1].CLOSE;
          if (CHANGE > 0) GAINS += CHANGE;
          else LOSSES -= CHANGE;
        }
      }

      // Calcula el promedio de ganancias y pérdidas.
      const AVG_GAIN = GAINS / RSI_PERIOD;
      const AVG_LOSS = LOSSES / RSI_PERIOD;

      // Calcula el Relative Strength (RS) y el RSI.
      const RS =
        AVG_LOSS === 0 ? (AVG_GAIN === 0 ? 0 : 100) : AVG_GAIN / AVG_LOSS;
      const RSI = 100 - 100 / (1 + RS);
      RSI_VALUES.push(parseFloat(RSI.toFixed(2)));
    }

    // Variables para la simulación de la estrategia.
    const SIGNALS = [];
    let UNITS_HELD = 0; // Unidades del activo en posesión
    let CASH = parseFloat(AMOUNT); // Capital disponible
    let TOTAL_BOUGHT_UNITS = 0; // Total de unidades compradas a lo largo de la simulación
    let TOTAL_SOLD_UNITS = 0; // Total de unidades vendidas a lo largo de la simulación
    const BOUGHT_PRICES = []; // Registro de compras para cálculo FIFO
    let REAL_PROFIT = 0; // Ganancia/pérdida realizada
    const NEW_CHART_DATA = []; // Datos para la visualización en un gráfico (modificado)

    // Bucle principal de la simulación, iterando sobre los precios filtrados.
    for (let I = 0; I < FILTERED_PRICES.length; I++) {
      const {
        DATE,
        OPEN,
        HIGH,
        LOW,
        CLOSE: PRICE, // Renombra CLOSE a PRICE para mayor claridad
        VOLUME,
      } = FILTERED_PRICES[I];

      // Ignora las fechas fuera del rango de simulación (ya filtradas, pero como doble chequeo).
      if (
        new Date(DATE) < new Date(STARTDATE) ||
        new Date(DATE) > new Date(ENDDATE)
      )
        continue;

      const SMA = SMA_VALUES[I];
      const RSI = RSI_VALUES[I];

      let CURRENT_SIGNAL_TYPE = null;
      let CURRENT_REASONING = null;
      let UNITS_TRANSACTED = 0;
      let PROFIT_LOSS = 0;

      // Lógica de la estrategia: Señal de COMPRA
      // Compra si el precio está significativamente por debajo del SMA y hay efectivo disponible.
      if (PRICE < SMA * 0.98 && CASH > 0) {
        const INVESTMENT_AMOUNT = CASH * 0.5; // Invierte el 50% del efectivo disponible
        UNITS_TRANSACTED = INVESTMENT_AMOUNT / PRICE;
        const SPENT = UNITS_TRANSACTED * PRICE;
        UNITS_HELD += UNITS_TRANSACTED;
        CASH -= SPENT;
        TOTAL_BOUGHT_UNITS += UNITS_TRANSACTED;
        // Registra la compra para el cálculo FIFO.
        BOUGHT_PRICES.push({ DATE, PRICE, UNITS: UNITS_TRANSACTED });

        CURRENT_SIGNAL_TYPE = "buy"; // Cambiado a minúsculas
        CURRENT_REASONING = `EL PRECIO ESTÁ POR DEBAJO DEL 98% DEL SMA. RSI: ${RSI.toFixed(
          2
        )}`;
      }
      // Lógica de la estrategia: Señal de VENTA
      // Vende si el precio está significativamente por encima del SMA y hay unidades en posesión.
      else if (PRICE > SMA * 1.02 && UNITS_HELD > 0) {
        const UNITS_TO_SELL = UNITS_HELD * 0.25; // Vende el 25% de las unidades en posesión
        const REVENUE = UNITS_TO_SELL * PRICE;
        CASH += REVENUE;
        UNITS_HELD -= UNITS_TO_SELL;
        TOTAL_SOLD_UNITS += UNITS_TO_SELL;
        UNITS_TRANSACTED = UNITS_TO_SELL;

        // Lógica FIFO para calcular la ganancia/pérdida real de las unidades vendidas.
        let SOLD_UNITS_COUNTER = UNITS_TO_SELL;
        let COST_OF_SOLD_UNITS = 0;
        let UNITS_REMOVED_FROM_BOUGHT = []; // Para limpiar el registro de compras

        for (let J = 0; J < BOUGHT_PRICES.length; J++) {
          if (SOLD_UNITS_COUNTER <= 0) break; // Si ya se vendieron todas las unidades necesarias, salir.

          const PURCHASE = BOUGHT_PRICES[J];
          const UNITS_FROM_THIS_PURCHASE = Math.min(
            PURCHASE.UNITS,
            SOLD_UNITS_COUNTER
          );
          COST_OF_SOLD_UNITS += UNITS_FROM_THIS_PURCHASE * PURCHASE.PRICE;
          SOLD_UNITS_COUNTER -= UNITS_FROM_THIS_PURCHASE;

          BOUGHT_PRICES[J].UNITS -= UNITS_FROM_THIS_PURCHASE;
          if (BOUGHT_PRICES[J].UNITS <= 0) {
            UNITS_REMOVED_FROM_BOUGHT.push(J); // Marca las compras agotadas para eliminación.
          }
        }

        // Elimina las entradas de compras agotadas del registro (en orden inverso para evitar problemas de índice).
        for (let K = UNITS_REMOVED_FROM_BOUGHT.length - 1; K >= 0; K--) {
          BOUGHT_PRICES.splice(UNITS_REMOVED_FROM_BOUGHT[K], 1);
        }

        const AVG_PURCHASE_PRICE_FOR_SOLD_UNITS =
          COST_OF_SOLD_UNITS / UNITS_TO_SELL;
        PROFIT_LOSS =
          (PRICE - AVG_PURCHASE_PRICE_FOR_SOLD_UNITS) * UNITS_TO_SELL;
        REAL_PROFIT += PROFIT_LOSS;

        CURRENT_SIGNAL_TYPE = "sell"; // Cambiado a minúsculas
        CURRENT_REASONING = `EL PRECIO ESTÁ POR ENCIMA DEL 102% DEL SMA. RSI: ${RSI.toFixed(
          2
        )}`;
      }

      // Si se generó una señal (compra o venta), registrarla.
      if (CURRENT_SIGNAL_TYPE) {
        SIGNALS.push({
          DATE,
          TYPE: CURRENT_SIGNAL_TYPE,
          PRICE: parseFloat(PRICE.toFixed(2)),
          REASONING: CURRENT_REASONING,
          SHARES: parseFloat(UNITS_TRANSACTED.toFixed(15)), // Alta precisión para las unidades
          PROFIT: parseFloat(PROFIT_LOSS.toFixed(2)),
        });
      }

      // Añade los datos para el gráfico con la nueva estructura.
      NEW_CHART_DATA.push({
        DATE,
        OPEN: parseFloat(OPEN.toFixed(2)),
        HIGH: parseFloat(HIGH.toFixed(2)),
        LOW: parseFloat(LOW.toFixed(2)),
        CLOSE: parseFloat(PRICE.toFixed(2)),
        VOLUME: parseFloat(VOLUME.toFixed(0)), // Volumen como entero
        INDICATORS: [
          { INDICATOR: "sma", VALUE: parseFloat((SMA ?? 0).toFixed(2)) },
          { INDICATOR: "rsi", VALUE: parseFloat((RSI ?? 0).toFixed(2)) }
        ]
      });
    }

    // Calcula el valor final de las unidades restantes.
    let FINAL_VALUE = 0;
    const lastPriceData = FILTERED_PRICES[FILTERED_PRICES.length - 1];
    if (lastPriceData && UNITS_HELD > 0) {
        FINAL_VALUE = UNITS_HELD * lastPriceData.CLOSE; // Usar el precio de cierre del último día
    }

    // Calcula el balance final y el porcentaje de retorno.
    const FINAL_BALANCE_CALCULATED = CASH + FINAL_VALUE;
    const PERCENTAGE_RETURN = ((FINAL_BALANCE_CALCULATED - AMOUNT) / AMOUNT) * 100;

    // Objeto SUMMARY con los cálculos finales.
    const SUMMARY = {
      TOTAL_BOUGHT_UNITS: parseFloat(TOTAL_BOUGHT_UNITS.toFixed(5)),
      TOTAL_SOLD_UNITS: parseFloat(TOTAL_SOLD_UNITS.toFixed(5)),
      REMAINING_UNITS: parseFloat(UNITS_HELD.toFixed(5)),
      FINAL_CASH: parseFloat(CASH.toFixed(2)),
      FINAL_VALUE: parseFloat(FINAL_VALUE.toFixed(2)),
      FINAL_BALANCE: parseFloat(FINAL_BALANCE_CALCULATED.toFixed(2)),
      REAL_PROFIT: parseFloat(REAL_PROFIT.toFixed(2)),
      PERCENTAGE_RETURN: parseFloat(PERCENTAGE_RETURN.toFixed(2))
    };

    // Objeto DETAIL_ROW (información de registro).
    const DETAIL_ROW = [
      {
        ACTIVED: true,
        DELETED: false,
        DETAIL_ROW_REG: [
          {
            CURRENT: true,
            REGDATE: new Date().toISOString().slice(0, 10), // Fecha actual YYYY-MM-DD
            REGTIME: new Date().toLocaleTimeString('es-ES', { hour12: false }), // Hora actual HH:MM:SS
            REGUSER: USERID // Usuario de la solicitud
          }
        ]
      }
    ];

    // Retorna los resultados finales de la simulación con la nueva estructura.
    return {
      SIMULATIONID,
      USERID,
      STRATEGYID,
      SIMULATIONNAME,
      SYMBOL,
      // CORRECCIÓN: Ahora 'INDICATORS' es un objeto con una propiedad 'value'
      // que contiene el arreglo original de 'SPECS' de la solicitud.
      INDICATORS: { value: SPECS },
      AMOUNT: parseFloat(AMOUNT.toFixed(2)),
      STARTDATE,
      ENDDATE,
      SIGNALS,
      SUMMARY,
      CHART_DATA: NEW_CHART_DATA,
      DETAIL_ROW
    };
  } catch (ERROR) {
    // Manejo de errores, imprime el mensaje de error y lo relanza.
    console.error("ERROR EN LA FUNCIÓN REVERSION_SIMPLE:", ERROR.message);
    throw ERROR;
  }
}

module.exports = {
  crudSimulation,
  crudStrategies,
  company,
  strategy,
  priceshistory,
  reversionSimple,
};

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
      case "post": // Crear una nueva simulación usando HISTORICAL_OPTIONS
        try {
          const { symbol, initial_investment } = req?.req?.query || {};

          if (!symbol || !initial_investment) {
            throw new Error(
              "Se deben proporcionar 'symbol' e 'initial_investment'."
            );
          }

          // const apiKey = "9BIPPPBV4TA9MZGE"; // Reemplaza con tu clave real
          const apiKey = "demo";
          const apiUrl = `https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${symbol}&apikey=${apiKey}`;

          const response = await axios.get(apiUrl);
          const optionsData = response.data?.data;
          if (!optionsData || optionsData.length === 0) {
            throw new Error("No se encontraron datos de opciones históricas.");
          }

          const validOptions = optionsData.filter((option) => {
            const isCallOption = option.type === "call";
            const isValidPrice = parseFloat(option.mark) > 0;
            const expirationDate = new Date(option.expiration);
            const currentDate = new Date();
            const isValidDate = expirationDate > currentDate;
            return isCallOption && isValidPrice && isValidDate;
          });

          if (validOptions.length === 0) {
            throw new Error(
              "No hay suficientes datos válidos para calcular la estrategia."
            );
          }

          const markPricesByExpirationDate = {};
          for (const option of validOptions) {
            const expirationDate = option.expiration;
            const price = parseFloat(option.mark);
            if (!markPricesByExpirationDate[expirationDate])
              markPricesByExpirationDate[expirationDate] = [];
            markPricesByExpirationDate[expirationDate].push(price);
          }

          const expirationDates = Object.keys(
            markPricesByExpirationDate
          ).sort();
          const prices = expirationDates.map((expirationDate) => {
            const avgPrice =
              markPricesByExpirationDate[expirationDate].reduce(
                (sum, p) => sum + p,
                0
              ) / markPricesByExpirationDate[expirationDate].length;
            return { date: expirationDate, close: avgPrice };
          });

          if (prices.length < 5) {
            throw new Error(
              "No hay suficientes datos para calcular la estrategia."
            );
          }

          // Usar smaPeriod dinámico dependiendo de cuántos precios haya
          const smaPeriod = Math.min(5, prices.length);
          const smaValues = prices.map((_, index, arr) => {
            if (index < smaPeriod - 1) return null;
            const sum = arr
              .slice(index - smaPeriod + 1, index + 1)
              .reduce((acc, val) => acc + val.close, 0);
            return sum / smaPeriod;
          });

          let entryPrice = null;
          let exitPrice = null;
          let entryDate = null;
          let exitDate = null;
          let recommendation = "SELL"; // Inicialmente, la recomendación es "SELL"

          for (let i = smaPeriod; i < prices.length; i++) {
            const price = prices[i].close;
            const sma = smaValues[i];
            if (!sma) continue;

            // Condición de entrada para compra (BUY)
            if (!entryPrice && price < sma * 0.95) {
              entryPrice = price;
              entryDate = prices[i].date;
              recommendation = "BUY"; // Si el precio está por debajo del 95% del SMA, recomendamos comprar
            }
            // Condición de salida para venta (SELL)
            else if (entryPrice && price > sma * 1.05) {
              exitPrice = price;
              exitDate = prices[i].date;
              recommendation = "SELL"; // Si el precio supera el 105% del SMA, recomendamos vender
              break;
            }
          }

          if (!entryPrice || !exitPrice) {
            throw new Error(
              "No se encontraron puntos de entrada y salida según la estrategia."
            );
          }

          const profit = exitPrice - entryPrice;
          const returnPercentage = profit / entryPrice;
          const periodDays =
            (new Date(exitDate) - new Date(entryDate)) / (1000 * 60 * 60 * 24);

          const recentPrices = prices.slice(-smaPeriod);
          const priceChanges = recentPrices
            .map((val, idx, arr) =>
              idx === 0 ? 0 : val.close - arr[idx - 1].close
            )
            .slice(1);
          const avgChange =
            priceChanges.reduce((acc, val) => acc + val, 0) /
            priceChanges.length;
          const volatility =
            priceChanges.reduce(
              (acc, val) => acc + Math.pow(val - avgChange, 2),
              0
            ) / priceChanges.length;

          let trend = "sideways";
          if (avgChange > 0) trend = "bullish";
          else if (avgChange < 0) trend = "bearish";

          let volatilityLevel = "low";
          if (volatility > 2) volatilityLevel = "high";
          else if (volatility > 1) volatilityLevel = "medium";

          const simulation = {
            SIMULATION_ID: `SIMULATION_${Date.now()}`,
            STRATEGY_NAME: "Reversión Simple",
            DATE: new Date().toISOString(),
            SYMBOL: symbol,
            ASSET_TYPE: "STOCK",
            ASSET_NAME: symbol,
            INITIAL_INVESTMENT: initial_investment,
            PERIOD_DAYS: periodDays,
            START_DATE: entryDate,
            END_DATE: exitDate,
            RECOMMENDATION: recommendation, // La recomendación es dinámica ("BUY" o "SELL")
            ENTRY_PRICE: entryPrice,
            EXIT_PRICE: exitPrice,
            PROFIT: profit,
            RETURN_PERCENTAGE: returnPercentage,
            SOLD: true,
            SELL_DATE: exitDate,
            TREND: trend,
            VOLATILITY: volatilityLevel,
            URL_DATA: apiUrl,
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
        } catch (error) {
          console.error("Error detallado:", error.message || error);
          throw new Error(
            `Error al crear la simulación: ${error.message || error}`
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

module.exports = { crudSimulation };

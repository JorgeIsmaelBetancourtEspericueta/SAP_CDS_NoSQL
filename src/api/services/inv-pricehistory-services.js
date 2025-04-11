const ztpricehistory = require("../models/mongoDB/ztpricehistory");
const mongoose = require("mongoose");

async function GetAllPricesHistory(req) {
  try {
    const IdPrice = parseInt(req.req.query?.IdPrice);
    const IniVolume = parseFloat(req.req.query?.IniVolume);
    const EndVolume = parseFloat(req.req.query?.EndVolume);

    let pricehistory;

    //Donde el volumen de ventas esté estre un rango de valores

    if (IdPrice >= 0) {
      pricehistory = await ztpricehistory.findOne({ ID: IdPrice }).lean();
      console.log(pricehistory);
    } else if (IniVolume >= 0 && EndVolume >= 0) {
      pricehistory = await ztpricehistory
        .find({ VOLUME: { $gte: IniVolume, $lte: EndVolume } })
        .lean();
      console.log(pricehistory);
    } else {
      pricehistory = await ztpricehistory.find().lean();
      console.log(pricehistory);
    }

    return pricehistory;
  } catch (error) {
    return error;
  } finally {
  }
}

// Add one and some
async function AddOnePricesHistory(req) {
  try {
    const newPrices = req.req.body.prices;

    let pricesHistory;
    pricesHistory = await ztpricehistory.insertMany(newPrices, {
      order: true,
    });
    return JSON.parse(JSON.stringify(pricesHistory));
  } catch (error) {
    throw error;
  } finally {
  }
}

// Put one
async function UpdateOnePriceHistory(req) {
  try {
    const Id = parseInt(req.req.query?.Id); // Obtener el parámetro Id desde la consulta
    const newPrices = req.req.body.prices; // El objeto con los datos de precios que quieres actualizar

    // Actualizar el registro en la base de datos
    let updatedHistory = await ztpricehistory.updateOne(
      { ID: Id }, // Condición para encontrar el registro por ID
      { $set: newPrices } // Actualizar los campos excepto ID
    );

    // Verificar si se actualizó algún documento
    if (updatedHistory.matchedCount === 0) {
      throw new Error("Price history not found");
    }

    let pricehistory = await ztpricehistory
      .findOne({ ID: newPrices.ID })
      .lean();

    // Devolver el registro actualizado
    return JSON.parse(JSON.stringify(pricehistory));
  } catch (error) {
    console.error("Error updating price history:", error.message);
    throw error;
  }
}

async function DeleteOnePriceHistory(req) {
  try {
    // Obtener el ID desde la consulta de la URL
    const IdPrice = parseInt(req.req.query?.IdPrice); // El ID del precio que quieres eliminar

    // Verificar si se proporcionó un ID válido
    if (isNaN(IdPrice) || IdPrice <= 0) {
      throw new Error("Invalid ID provided.");
    }

    // Eliminar el historial con el ID especificado
    const deleteResult = await ztpricehistory.deleteOne({ ID: IdPrice });

    // Verificar si se eliminó algún documento
    if (deleteResult.deletedCount === 0) {
      throw new Error("Price history not found for the given ID.");
    }

    // Retornar un mensaje de éxito
    return { message: "Price history eliminado exitosamente" };
  } catch (error) {
    console.error("Error deleting price history:", error.message);
    throw error;
  }
}

// Servicio para hacer el lookup entre ZTLABELS y ZTVALUES
async function GetLabelsWithValues() {
  try {
    const result = await mongoose.connection
      .collection("ZTLABELS")
      .aggregate([
        {
          $lookup: {
            from: "ZTVALUES",
            localField: "LABELID",
            foreignField: "LABELID",
            as: "VALUES",
          },
        },
      ])
      .toArray();

    return result;
  } catch (error) {
    console.error("Error en la agregación con $lookup:", error.message);
    throw error;
  }
}

module.exports = {
  GetAllPricesHistory,
  AddOnePricesHistory,
  UpdateOnePriceHistory,
  DeleteOnePriceHistory,
  GetLabelsWithValues,
};

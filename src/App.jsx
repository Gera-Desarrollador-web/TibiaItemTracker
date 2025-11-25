import { useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";

// 🔤 Convertir siempre a Title Case (cada palabra inicia con mayúscula)
function toTitleCase(text) {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function App() {
  const [char, setChar] = useState("");
  const [item, setItem] = useState("");
  const [status, setStatus] = useState("lo tiene");

  const [searchItem, setSearchItem] = useState("");
  const [searchChar, setSearchChar] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const charsRef = collection(db, "chars");

  // ➤ Guardar datos
  const saveData = async () => {
    if (!char || !item) return alert("Faltan datos");

    await addDoc(charsRef, {
      char: toTitleCase(char),
      item: toTitleCase(item),
      status,
      createdAt: Date.now(),
    });

    alert("Guardado correctamente");

    setItem("");
    setStatus("lo tiene");
  };

  // ➤ Borrar un registro específico
  const deleteData = async () => {
    if (!char || !item || !status)
      return alert("Debes llenar char, item y status para borrar");

    const q = query(
      charsRef,
      where("char", "==", toTitleCase(char)),
      where("item", "==", toTitleCase(item)),
      where("status", "==", status)
    );

    const docs = await getDocs(q);

    if (docs.empty) {
      alert("No se encontró ese registro");
      return;
    }

    for (const d of docs.docs) {
      await deleteDoc(d.ref);
    }

    alert("Registro(s) eliminado(s)");
    setItem("");
  };

  // ➤ Buscar por item + borrar viejos
  const searchByItem = async () => {
    if (!searchItem) return;

    const normalized = toTitleCase(searchItem);
    const q = query(charsRef, where("item", "==", normalized));
    const results = await getDocs(q);

    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const validResults = [];

    for (const docSnap of results.docs) {
      const data = docSnap.data();

      if (data.status !== "lo tiene" && now - data.createdAt > oneWeek) {
        await deleteDoc(docSnap.ref);
        continue;
      }

      validResults.push({ id: docSnap.id, ...data });
    }

    setSearchResults(validResults);
  };

  // ➤ Buscar por char + borrar viejos (ORDENADO + VERDE)
  const searchByChar = async () => {
    if (!searchChar) return;

    const normalized = toTitleCase(searchChar);
    const q = query(charsRef, where("char", "==", normalized));
    const results = await getDocs(q);

    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    let validResults = [];

    for (const docSnap of results.docs) {
      const data = docSnap.data();

      if (data.status !== "lo tiene" && now - data.createdAt > oneWeek) {
        await deleteDoc(docSnap.ref);
        continue;
      }

      validResults.push({ id: docSnap.id, ...data });
    }

    // ➤ Ordenar: primero los que lo tienen (lo tiene), luego los que necesitan
    validResults.sort((a, b) => {
      if (a.status === "lo tiene" && b.status !== "lo tiene") return -1;
      if (a.status !== "lo tiene" && b.status === "lo tiene") return 1;
      return a.item.localeCompare(b.item);
    });

    setSearchResults(validResults);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">
          Items Tibia Tracker
        </h1>

        {/* FORM AGREGAR */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Agregar / Borrar item</h2>

          <input
            placeholder="Nombre del char"
            value={char}
            onChange={(e) => setChar(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <input
            placeholder="Nombre del item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="necesita">Necesita</option>
            <option value="lo tiene">Lo tiene</option>
          </select>

          <div className="flex gap-3">
            <button
              onClick={saveData}
              className="w-1/2 bg-indigo-600 text-white py-2 rounded-md shadow-md hover:bg-indigo-700 transition"
            >
              Guardar
            </button>

            <button
              onClick={deleteData}
              className="w-1/2 bg-red-600 text-white py-2 rounded-md shadow-md hover:bg-red-700 transition"
            >
              Borrar
            </button>
          </div>
        </div>

        <hr className="my-6" />

        {/* BUSCAR POR ITEM */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Buscar item</h2>

          <input
            placeholder="Item a buscar"
            value={searchItem}
            onChange={(e) => setSearchItem(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            onClick={searchByItem}
            className="w-full bg-green-600 text-white py-2 rounded-md shadow-md hover:bg-green-700 transition"
          >
            Buscar por Item
          </button>
        </div>

        {/* BUSCAR POR CHAR */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Buscar por Char</h2>

          <input
            placeholder="Nombre del char"
            value={searchChar}
            onChange={(e) => setSearchChar(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <button
            onClick={searchByChar}
            className="w-full bg-blue-600 text-white py-2 rounded-md shadow-md hover:bg-blue-700 transition"
          >
            Buscar por char
          </button>
        </div>

        {/* RESULTADOS */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-700 mb-2">Resultados:</h3>

          {searchResults.length === 0 && (
            <p className="text-gray-500">No encontrado</p>
          )}

          {searchResults.map((r) => (
            <div
              key={r.id}
              className="p-3 bg-gray-50 border rounded-md mb-2 shadow-sm"
            >
              <p className="text-gray-800">
                <span className="font-bold text-indigo-600">{r.char}</span>{" "}
                — <span className="text-gray-800 font-medium">{r.item}</span>{" "}
                —{" "}
                <span
                  className={
                    r.status === "lo tiene"
                      ? "text-green-600 font-bold"
                      : "text-gray-600"
                  }
                >
                  {r.status}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

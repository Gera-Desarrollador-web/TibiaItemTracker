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

// 🔤 Convertir siempre a Title Case
function toTitleCase(text) {
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function App() {
  const [char, setChar] = useState("");
  const [item, setItem] = useState("");
  const [status, setStatus] = useState("lo tiene");

  const [searchItem, setSearchItem] = useState("");
  const [searchChar, setSearchChar] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [statusFilter, setStatusFilter] = useState("todos");

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

  // ➤ Borrar
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
    if (docs.empty) return alert("No se encontró ese registro");

    for (const d of docs.docs) await deleteDoc(d.ref);

    alert("Registro(s) eliminado(s)");
    setItem("");
  };

  // 🔄 Función común de limpieza + ordenamiento
  const cleanAndSort = async (docs) => {
    const now = Date.now();

    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    let arr = [];

    for (const docSnap of docs) {
      const data = docSnap.data();

      // ❌ borrar si es "necesita" y tiene más de 1 semana
      if (data.status === "necesita" && now - data.createdAt > oneWeek) {
        await deleteDoc(docSnap.ref);
        continue;
      }

      // ❌ borrar si es "lo tiene" y tiene más de 1 mes
      if (data.status === "lo tiene" && now - data.createdAt > oneMonth) {
        await deleteDoc(docSnap.ref);
        continue;
      }

      arr.push({ id: docSnap.id, ...data });
    }

    // aplicar filtro
    if (statusFilter !== "todos") {
      arr = arr.filter((x) => x.status === statusFilter);
    }

    // orden final:
    // 1) por char A-Z
    // 2) necesita → lo tiene
    // 3) item A-Z
    arr.sort((a, b) => {
      const byChar = a.char.localeCompare(b.char);
      if (byChar !== 0) return byChar;

      if (a.status === "necesita" && b.status !== "necesita") return -1;
      if (a.status !== "necesita" && b.status === "necesita") return 1;

      return a.item.localeCompare(b.item);
    });

    return arr;
  };

  // ➤ Buscar por item
  const searchByItem = async () => {
    if (!searchItem) return;

    const normalized = toTitleCase(searchItem);
    const q = query(charsRef, where("item", "==", normalized));
    const results = await getDocs(q);

    setSearchResults(await cleanAndSort(results.docs));
  };

  // ➤ Buscar por char
  const searchByChar = async () => {
    if (!searchChar) return;

    const normalized = toTitleCase(searchChar);
    const q = query(charsRef, where("char", "==", normalized));
    const results = await getDocs(q);

    setSearchResults(await cleanAndSort(results.docs));
  };

  // ➤ Mostrar todos
  const getAllData = async () => {
    const snapshot = await getDocs(charsRef);
    setSearchResults(await cleanAndSort(snapshot.docs));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">
          Items Tibia Tracker
        </h1>
      <p className="text-sm text-gray-600 mb-6">
        Nota: Los items "necesita" se borran automáticamente después de 1 semana. Los items "lo tiene" se borran después de 1 mes.
        Creado por "Taros Stone"
      </p>
        {/* FORM AGREGAR */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Agregar / Borrar item</h2>

          <input
            placeholder="Nombre del char"
            value={char}
            onChange={(e) => setChar(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:ring-2 focus:ring-indigo-500"
          />

          <input
            placeholder="Nombre del item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:ring-2 focus:ring-indigo-500"
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
            className="w-full mb-3 px-3 py-2 rounded-md border focus:ring-2 focus:ring-indigo-500"
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
            className="w-full mb-3 px-3 py-2 rounded-md border focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-md border shadow-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="todos">Mostrar todos</option>
            <option value="lo tiene">Lo tiene</option>
            <option value="necesita">Necesita</option>
          </select>

          <button
            onClick={searchByChar}
            className="w-full bg-blue-600 text-white py-2 rounded-md shadow-md hover:bg-blue-700 transition"
          >
            Buscar por char
          </button>
        </div>

        {/* VER TODOS */}
        <button
          onClick={getAllData}
          className="w-full bg-purple-600 text-white py-2 rounded-md shadow-md hover:bg-purple-700 transition mt-6"
        >
          Ver todos los registros
        </button>

        {/* RESULTADOS */}
        <div className="mt-6 max-h-80 overflow-y-auto pr-2">
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
                      : "text-red-600 font-bold"
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

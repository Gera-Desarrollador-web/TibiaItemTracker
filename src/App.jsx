import React, { useEffect, useState, useRef } from "react";
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
  if (!text) return "";
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const LOCAL_KEY = "tibiaCharsData";
const LOCAL_LAST_SYNC = "tibiaCharsLastSync";
const SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutos

export default function App() {
  const [char, setChar] = useState("");
  const [item, setItem] = useState("");
  const [status, setStatus] = useState("lo tiene");

  const [searchItem, setSearchItem] = useState("");
  const [searchChar, setSearchChar] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [statusFilter, setStatusFilter] = useState("todos");

  // datos locales en memoria (se carga desde localStorage o Firebase)
  const [data, setData] = useState([]);

  const charsRef = collection(db, "chars");

  const syncTimerRef = useRef(null);

  // ---------- UTIL: ordena y filtra un arreglo plano (objetos {id, char, item, status, createdAt}) ----------
  const processLocalArray = (arr) => {
    // aplicar filtro por status (no borramos aquí, solo filtramos la vista)
    let out = [...arr];

    if (statusFilter !== "todos") {
      out = out.filter((x) => x.status === statusFilter);
    }

    // ordenar: char A-Z, necesita antes que lo tiene, item A-Z
    out.sort((a, b) => {
      const byChar = a.char.localeCompare(b.char);
      if (byChar !== 0) return byChar;

      if (a.status === "necesita" && b.status !== "necesita") return -1;
      if (a.status !== "necesita" && b.status === "necesita") return 1;

      return a.item.localeCompare(b.item);
    });

    return out;
  };

  // ---------- LIMPIEZA + ORDENADO cuando trabajamos con snapshot.docs de Firebase ----------
  const cleanAndSortFirebaseDocs = async (docs) => {
    const now = Date.now();

    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    let arr = [];

    for (const docSnap of docs) {
      const data = docSnap.data();

      // borrar en Firestore según reglas de antigüedad
      if (data.status === "necesita" && now - data.createdAt > oneWeek) {
        try {
          await deleteDoc(docSnap.ref);
        } catch (e) {
          console.warn("No se pudo borrar doc vieja (necesita):", docSnap.id, e);
        }
        continue;
      }

      if (data.status === "lo tiene" && now - data.createdAt > oneMonth) {
        try {
          await deleteDoc(docSnap.ref);
        } catch (e) {
          console.warn("No se pudo borrar doc vieja (lo tiene):", docSnap.id, e);
        }
        continue;
      }

      arr.push({ id: docSnap.id, ...data });
    }

    // ya tenemos arr plano; aplicar orden y filtro
    const processed = processLocalArray(arr);
    return processed;
  };

  // ---------- Sincronizar desde Firebase -> actualiza data y localStorage ----------
  const syncFromFirebase = async () => {
    try {
      const snapshot = await getDocs(charsRef);

      // limpiamos y borramos en Firestore según reglas
      await cleanAndSortFirebaseDocs(snapshot.docs);

      // construimos la copia completa que guardaremos localmente (aplicando también expiración local)
      const fullArr = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((dataObj) => {
          const now = Date.now();
          const oneWeek = 7 * 24 * 60 * 60 * 1000;
          const oneMonth = 30 * 24 * 60 * 60 * 1000;
          if (dataObj.status === "necesita" && now - dataObj.createdAt > oneWeek)
            return false;
          if (dataObj.status === "lo tiene" && now - dataObj.createdAt > oneMonth)
            return false;
          return true;
        });

      // Guardamos la copia completa y la vista procesada en memoria
      localStorage.setItem(LOCAL_KEY, JSON.stringify(fullArr));
      localStorage.setItem(LOCAL_LAST_SYNC, Date.now().toString());
      setData(fullArr);
      // actualizar vista actual (aplica filtros y orden)
      setSearchResults(processLocalArray(fullArr));
    } catch (e) {
      console.error("Error sincronizando desde Firebase:", e);
    }
  };

  // ---------- Cargar desde localStorage si existe, si no existe -> sincronizar Firebase ----------
  useEffect(() => {
    setSearchResults([]);

    const localRaw = localStorage.getItem(LOCAL_KEY);
    const lastSync = Number(localStorage.getItem(LOCAL_LAST_SYNC) || "0");
    const now = Date.now();

    if (localRaw) {
      try {
        const localArr = JSON.parse(localRaw);
        setData(localArr);
        setSearchResults(processLocalArray(localArr));
      } catch (e) {
        console.warn("localStorage corrupto, forzando sync:", e);
      }
    }

    // Si no hay local o la última sync fue hace más de 1h, hacemos sync inmediata
    if (!localRaw || now - lastSync > SYNC_INTERVAL_MS) {
      syncFromFirebase();
    }

    // programar sync cada hora
    syncTimerRef.current = setInterval(() => {
      syncFromFirebase();
    }, SYNC_INTERVAL_MS);

    // cleanup
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Guardar: agrega a Firebase y actualiza local en memoria + localStorage ----------
  const saveData = async () => {
    if (!char || !item) return alert("Faltan datos");

    const payload = {
      char: toTitleCase(char),
      item: toTitleCase(item),
      status,
      createdAt: Date.now(),
    };

    try {
      const docRef = await addDoc(charsRef, payload);

      // actualizar copia local
      const newObj = { id: docRef.id, ...payload };
      const newData = [...data, newObj];
      localStorage.setItem(LOCAL_KEY, JSON.stringify(newData));
      // actualizamos last sync porque estamos en sync con firebase ahora
      localStorage.setItem(LOCAL_LAST_SYNC, Date.now().toString());

      setData(newData);
      setSearchResults(processLocalArray(newData));

      alert("Guardado correctamente");
      setItem("");
      setStatus("lo tiene");
    } catch (e) {
      console.error("Error guardando en Firebase:", e);
      alert("Error guardando. Revisa la consola.");
    }
  };

  // ---------- Borrar: elimina en Firebase y actualiza local ----------
  const deleteData = async () => {
    if (!char || !item || !status)
      return alert("Debes llenar char, item y status para borrar");

    const normalizedChar = toTitleCase(char);
    const normalizedItem = toTitleCase(item);

    try {
      const q = query(
        charsRef,
        where("char", "==", normalizedChar),
        where("item", "==", normalizedItem),
        where("status", "==", status)
      );

      const docs = await getDocs(q);
      if (docs.empty) {
        alert("No se encontró ese registro");
        return;
      }

      // borrar cada doc en Firestore
      for (const d of docs.docs) {
        try {
          await deleteDoc(d.ref);
        } catch (e) {
          console.warn("No se pudo borrar doc en Firestore:", d.id, e);
        }
      }

      // actualizar copia local (filtrando por coincidencias exactas)
      const newData = data.filter(
        (x) =>
          !(
            x.char === normalizedChar &&
            x.item === normalizedItem &&
            x.status === status
          )
      );

      localStorage.setItem(LOCAL_KEY, JSON.stringify(newData));
      localStorage.setItem(LOCAL_LAST_SYNC, Date.now().toString());

      setData(newData);
      setSearchResults(processLocalArray(newData));

      alert("Registro(s) eliminado(s)");
      setItem("");
    } catch (e) {
      console.error("Error borrando:", e);
      alert("Error borrando. Revisa la consola.");
    }
  };

  // ---------- Buscar por item (usa data local) ----------
  const searchByItem = async () => {
    if (!searchItem) return;

    const normalized = toTitleCase(searchItem);
    const results = data.filter((x) => x.item === normalized);
    setSearchResults(processLocalArray(results));
  };

  // ---------- Buscar por char (usa data local) ----------
  const searchByChar = async () => {
    if (!searchChar) return;

    const normalized = toTitleCase(searchChar);
    const results = data.filter((x) => x.char === normalized);
    setSearchResults(processLocalArray(results));
  };

  // ---------- Mostrar todos (desde local) ----------
  const getAllData = async () => {
    // si no hay data local (por alguna razón), forzamos una sync
    if (!data || data.length === 0) {
      await syncFromFirebase();
      return;
    }

    setSearchResults(processLocalArray(data));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-start py-10 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-6 text-indigo-600">
          Items Tibia Tracker
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Nota: Los items "necesita" se borran automáticamente después de 1
          semana. Los items "lo tiene" se borran después de 1 mes. La app usa
          copia local para ahorrar lecturas a Firebase; se sincroniza con
          Firebase cada 1 hora.
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
            onChange={(e) => {
              setStatusFilter(e.target.value);
              // aplicar filtro inmediato sobre la vista actual
              setSearchResults(processLocalArray(data));
            }}
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
              key={r.id + r.char + r.item}
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

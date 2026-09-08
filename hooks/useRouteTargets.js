import { useState } from "react";

// ROTA HEDEFLERİ — başlangıç, varış ve arama alanlarının durumu.

export const BOS_HEDEFLER = {
  origin: null,
  destination: null,
  originText: "",
  destText: "",
};

export function hedefAlani(activeInput, origin) {
  if (activeInput === "origin" || activeInput === "dest") return activeInput;
  return origin ? "dest" : "origin";
}


export function noktaYaz(hedefler, alan, coord, name) {
  const yeni = alan === "origin"
    ? { ...hedefler, origin: coord, originText: name }
    : { ...hedefler, destination: coord, destText: name };
  return { hedefler: yeni, hazir: !!(yeni.origin && yeni.destination) };
}

export function hedefleriTakasla(hedefler) {
  return {
    origin: hedefler.destination,
    destination: hedefler.origin,
    originText: hedefler.destText,
    destText: hedefler.originText,
  };
}

export function useRouteTargets() {
  const [hedefler, setHedefler] = useState(BOS_HEDEFLER);
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);

  const noktaSec = (alan, coord, name) => {
    const { hedefler: yeni, hazir } = noktaYaz(hedefler, alan, coord, name);
    setHedefler(yeni);
    return hazir ? yeni : null;
  };

  // Yalnız metin değişimi — koordinat henüz seçilmedi.
  const metinYaz = (alan, text) => {
    setHedefler((cur) => (alan === "origin"
      ? { ...cur, originText: text }
      : { ...cur, destText: text }));
  };

  const takasla = () => {
    if (!hedefler.origin && !hedefler.destination) return null;
    const yeni = hedefleriTakasla(hedefler);
    setHedefler(yeni);
    return yeni.origin && yeni.destination ? yeni : null;
  };

  const aramayiKapat = () => {
    setSuggestions([]);
    setActiveInput(null);
  };

  const temizle = () => {
    setHedefler(BOS_HEDEFLER);
    aramayiKapat();
  };

  return {
    ...hedefler,
    hedefler,
    suggestions, setSuggestions,
    activeInput, setActiveInput,
    hedefAlani: () => hedefAlani(activeInput, hedefler.origin),
    noktaSec, metinYaz, takasla, aramayiKapat, temizle,
  };
}

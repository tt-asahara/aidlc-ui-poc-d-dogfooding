// U3 storage の公開窓口（契約 C2）。U4 はこのファイルだけを import し、IndexedDB を直接使わない。
export type {
  KeyOf,
  MemoryStorageOptions,
  MetaRecord,
  OpenStorageOptions,
  RecordOf,
  StorageError,
  StorageHandle,
  StorageOpenError,
  StoreName,
  TxContext,
  WriteError,
} from "./types";
export { openStorage } from "./idbStorage";
export { createMemoryStorage } from "./memoryStorage";

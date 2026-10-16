// ファイル選択（C6 FileInputProps、BR7.1、BR2.4）。標準の file 入力に見えるラベルを付ける。
// Enter・Space で選択画面を開くのはブラウザの標準の振る舞い。選んだ最初のファイルを渡した後は入力を空に戻し、
// 同じファイルをもう一度選べるようにする。ファイルの中身は読まない（解析は U6 の役割）。
import type { ChangeEvent, Ref } from "react";

export interface FileInputProps {
  id: string;
  label: string;
  /** 受け付ける種類（例: ".csv,text/csv"）。 */
  accept: string;
  onSelect: (file: File) => void;
  disabled?: boolean;
  /** file 入力の DOM 要素への参照（取り込みプレビューを閉じた後のフォーカスの戻し先。AC9.2.3）。 */
  ref?: Ref<HTMLInputElement>;
}

export function FileInput({ id, label, accept, onSelect, disabled = false, ref }: FileInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // 先に空へ戻す（files は value を空にすると消えるため、ファイルは取り出してから戻す）。
    input.value = "";
    // ファイルが選ばれなかった（選択画面を閉じただけ）ときは何もしない。
    if (file !== undefined) onSelect(file);
  };

  return (
    <div className="uk-file-input">
      <label className="uk-file-input__label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className="uk-file-input__input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  );
}

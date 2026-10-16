// 入力欄（C6 TextFieldProps・SelectProps・RadioGroupProps・FieldErrorProps、BR3.1〜BR3.3、BR2.4）。
// 見えるラベルを必ず付け、エラーは入力欄の直下に「⚠ 項目名：直し方」として表示して aria-describedby で結ぶ。
import type { KeyboardEvent, Ref } from "react";

// ---- FieldError ----

export interface FieldErrorProps {
  /** 入力欄の aria-describedby から参照される id。 */
  id: string;
  /** 項目名（例: 「金額」）。 */
  field: string;
  /** 直し方（例: 「1〜99,999,999 の整数で入力してください」）。 */
  message: string;
}

/**
 * 表示する文を「項目名：直し方」にそろえる。
 * U1 の検証文言には「金額：…」「金額を入力してください」のように項目名から始まるものがあるため、
 * 項目名から始まる文はそのまま使い、二重に付けない。
 */
export function formatFieldError(field: string, message: string): string {
  return message.startsWith(field) ? message : `${field}：${message}`;
}

export function FieldError({ id, field, message }: FieldErrorProps) {
  return (
    <p id={id} className="uk-field-error">
      <span className="uk-symbol" aria-hidden="true">
        ⚠
      </span>
      {formatFieldError(field, message)}
    </p>
  );
}

// ---- 共通の部分 ----

function RequiredMark() {
  // 「*」は見た目の印。読み上げは入力欄の aria-required で伝える（BR3.1）。
  return (
    <span className="uk-field__required" aria-hidden="true">
      *
    </span>
  );
}

function joinIds(...ids: (string | undefined)[]): string | undefined {
  const present = ids.filter((value): value is string => value !== undefined);
  return present.length > 0 ? present.join(" ") : undefined;
}

/** 空文字のエラーは「エラーなし」として扱う（BR3.2 の trigger は error が空でないとき）。 */
function hasError(error: string | undefined): error is string {
  return error !== undefined && error !== "";
}

// ---- TextField ----

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  inputMode?: "text" | "numeric";
  maxLength?: number;
  /** 入力欄で Enter を押したとき（日本語の変換の確定中は呼ばない）。 */
  onEnter?: () => void;
  /** 入力欄の DOM 要素への参照（最初のエラー項目へのフォーカス移動などに使う。BR2.4）。 */
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  hint,
  error,
  inputMode = "text",
  maxLength,
  onEnter,
  ref,
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = hasError(error) ? `${id}-error` : undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (onEnter === undefined || event.key !== "Enter") return;
    // 変換の確定の Enter で送信しない。
    if (event.nativeEvent.isComposing) return;
    // onEnter を渡したときは呼び出し側が処理するので、フォームの送信を重ねない。
    event.preventDefault();
    onEnter();
  };

  return (
    <div className="uk-field">
      <label className="uk-field__label" htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </label>
      <input
        ref={ref}
        id={id}
        className="uk-input"
        type="text"
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={joinIds(hintId, errorId)}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      {hint && (
        <p id={hintId} className="uk-field__hint">
          {hint}
        </p>
      )}
      {hasError(error) && <FieldError id={`${id}-error`} field={label} message={error} />}
    </div>
  );
}

// ---- Select ----

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  error?: string;
  /** select 要素の DOM 要素への参照（BR2.4）。 */
  ref?: Ref<HTMLSelectElement>;
}

export function Select({ id, label, value, options, onChange, error, ref }: SelectProps) {
  const errorId = hasError(error) ? `${id}-error` : undefined;
  return (
    <div className="uk-field">
      <label className="uk-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        className="uk-select"
        value={value}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasError(error) && <FieldError id={`${id}-error`} field={label} message={error} />}
    </div>
  );
}

// ---- RadioGroup ----

export interface RadioOption<V extends string> {
  value: V;
  label: string;
}

export interface RadioGroupProps<V extends string> {
  legend: string;
  /** 同じ群のラジオの name。各ラジオの id にも使う（`${name}-${value}`）。 */
  name: string;
  value: V;
  options: RadioOption<V>[];
  onChange: (v: V) => void;
  /**
   * 選択中のラジオ（どれも選ばれていなければ先頭のラジオ）の DOM 要素への参照（BR2.4）。
   * キーボードで群に入ったときにフォーカスが当たる要素と同じ。
   */
  ref?: Ref<HTMLInputElement>;
}

export function RadioGroup<V extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  ref,
}: RadioGroupProps<V>) {
  const refIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  // 矢印キーでの選択の移動はブラウザの標準の radio の振る舞いに任せる（BR3.3）。
  return (
    <fieldset className="uk-radio-group">
      <legend className="uk-radio-group__legend">{legend}</legend>
      {options.map((option, index) => {
        const radioId = `${name}-${option.value}`;
        return (
          <span key={option.value} className="uk-radio">
            <input
              ref={index === refIndex ? ref : undefined}
              id={radioId}
              className="uk-radio__input"
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <label htmlFor={radioId}>{option.label}</label>
          </span>
        );
      })}
    </fieldset>
  );
}

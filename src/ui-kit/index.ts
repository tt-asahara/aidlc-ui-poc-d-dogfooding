// U2 ui-kit の公開窓口（契約 C6）。利用者の Unit（U7）はこのファイル以外を import しない。
// 見た目は CSS で、U7 が tokens.css → ui-kit.css の順に読み込む（CSS は TypeScript の公開窓口に含めない）。
export { Button, DEFAULT_BUSY_LABEL } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";

export { FieldError, RadioGroup, Select, TextField, formatFieldError } from "./fields";
export type {
  FieldErrorProps,
  RadioGroupProps,
  RadioOption,
  SelectOption,
  SelectProps,
  TextFieldProps,
} from "./fields";

export { DataTable } from "./DataTable";
export type { DataTableColumn, DataTableProps } from "./DataTable";

export { Dialog } from "./Dialog";
export type { DialogCloseReason, DialogProps } from "./Dialog";

export { DEFAULT_SLOW_AFTER_MS, SLOW_LOADING_TEXT, StatusPanel } from "./StatusPanel";
export type { StatusAction, StatusKind, StatusPanelProps } from "./StatusPanel";

export { DEFAULT_AUTO_HIDE_MS, InlineMessage } from "./InlineMessage";
export type { InlineMessageProps, InlineMessageTone } from "./InlineMessage";

export { FileInput } from "./FileInput";
export type { FileInputProps } from "./FileInput";

export { Tabs } from "./Tabs";
export type { TabItem, TabsProps } from "./Tabs";

export { breakpoints, color, cssVariables, font, motion, size, space } from "./tokens";

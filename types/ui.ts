/**
 * UI 컴포넌트 관련 타입 정의
 * 
 * 주요 역할:
 * 1. React 컴포넌트 Props 타입의 일관성 보장
 * 2. UI 상태 관리를 위한 타입 안전성 제공
 * 3. 이벤트 핸들러 및 콜백 함수 타입 정의
 * 
 * 핵심 특징:
 * - React 표준 타입과 호환되는 인터페이스
 * - 재사용 가능한 Generic 타입 활용
 * - 접근성과 사용성을 고려한 타입 설계
 * 
 * 주의사항:
 * - HTML 표준 속성과 충돌하지 않도록 주의
 * - 이벤트 핸들러는 React SyntheticEvent 타입 사용
 * - 선택적 props는 명시적으로 optional로 표시
 */

import { ReactNode, MouseEvent, KeyboardEvent, ChangeEvent, FormEvent } from 'react';

/**
 * 기본 컴포넌트 Props
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  id?: string;
  'data-testid'?: string;
}

/**
 * 크기 관련 타입
 */
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 색상 관련 타입
 */
export type Color = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'light' 
  | 'dark';

export type Variant = 
  | 'solid' 
  | 'outline' 
  | 'ghost' 
  | 'link';

/**
 * 위치 관련 타입
 */
export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Bounds extends Position, Dimensions {}

/**
 * 버튼 컴포넌트 타입
 */
export interface ButtonProps extends BaseComponentProps {
  variant?: Variant;
  size?: ButtonSize;
  color?: Color;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  'aria-label'?: string;
}

/**
 * Input 컴포넌트 타입
 */
export interface InputProps extends BaseComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  size?: Size;
  error?: boolean;
  helperText?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Modal 컴포넌트 타입
 */
export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  size?: Size;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode;
  onClose?: () => void;
}

/**
 * Dropdown 컴포넌트 타입
 */
export interface DropdownOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface DropdownProps<T = string> extends BaseComponentProps {
  options: DropdownOption<T>[];
  value?: T;
  defaultValue?: T;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  size?: Size;
  error?: boolean;
  helperText?: string;
  onChange?: (value: T | T[] | undefined) => void;
  onSearch?: (query: string) => void;
  renderOption?: (option: DropdownOption<T>) => ReactNode;
}

/**
 * Toast 알림 타입
 */
export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  closable?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onClose?: (id: string) => void;
}

/**
 * Loading 관련 타입
 */
export interface LoadingProps extends BaseComponentProps {
  size?: Size;
  color?: Color;
  text?: string;
  overlay?: boolean;
}

export interface SkeletonProps extends BaseComponentProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | false;
}

/**
 * Form 관련 타입
 */
export interface FormFieldProps extends BaseComponentProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

export interface FormProps extends BaseComponentProps {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  noValidate?: boolean;
}

/**
 * Table 관련 타입
 */
export interface TableColumn<T = unknown> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, record: T, index: number) => ReactNode;
}

export interface TableProps<T = unknown> extends BaseComponentProps {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  empty?: ReactNode;
  rowKey?: string | ((record: T) => string);
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  onRowClick?: (record: T, index: number) => void;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
}

/**
 * Navigation 관련 타입
 */
export interface NavigationItem {
  key: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  disabled?: boolean;
  children?: NavigationItem[];
  onClick?: () => void;
}

export interface NavigationProps extends BaseComponentProps {
  items: NavigationItem[];
  activeKey?: string;
  collapsed?: boolean;
  onItemClick?: (item: NavigationItem) => void;
}

/**
 * Card 컴포넌트 타입
 */
export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  hoverable?: boolean;
  bordered?: boolean;
  loading?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Badge 컴포넌트 타입
 */
export interface BadgeProps extends BaseComponentProps {
  count?: number;
  text?: string;
  color?: Color;
  variant?: 'solid' | 'outline' | 'dot';
  size?: Size;
  maxCount?: number;
  showZero?: boolean;
  offset?: [number, number];
}

/**
 * Avatar 컴포넌트 타입
 */
export interface AvatarProps extends BaseComponentProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: Size;
  shape?: 'circle' | 'square';
  fallback?: ReactNode;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Tooltip 컴포넌트 타입
 */
export interface TooltipProps extends BaseComponentProps {
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  disabled?: boolean;
}

/**
 * Popover 컴포넌트 타입
 */
export interface PopoverProps extends BaseComponentProps {
  content: ReactNode;
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnClickOutside?: boolean;
}

/**
 * Tabs 컴포넌트 타입
 */
export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  closable?: boolean;
  icon?: ReactNode;
}

export interface TabsProps extends BaseComponentProps {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  onTabClose?: (key: string) => void;
  size?: Size;
  type?: 'line' | 'card';
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Accordion 컴포넌트 타입
 */
export interface AccordionItem {
  key: string;
  title: string;
  content: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface AccordionProps extends BaseComponentProps {
  items: AccordionItem[];
  activeKeys?: string[];
  defaultActiveKeys?: string[];
  multiple?: boolean;
  onChange?: (keys: string[]) => void;
  expandIcon?: ReactNode;
  collapseIcon?: ReactNode;
}

/**
 * Progress 컴포넌트 타입
 */
export interface ProgressProps extends BaseComponentProps {
  value: number;
  max?: number;
  size?: Size;
  color?: Color;
  showText?: boolean;
  text?: string;
  striped?: boolean;
  animated?: boolean;
}

/**
 * Switch 컴포넌트 타입
 */
export interface SwitchProps extends BaseComponentProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  size?: Size;
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
  onChange?: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Checkbox 컴포넌트 타입
 */
export interface CheckboxProps extends BaseComponentProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Radio 컴포넌트 타입
 */
export interface RadioProps extends BaseComponentProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  value?: string;
  name?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export interface RadioGroupProps extends BaseComponentProps {
  value?: string;
  defaultValue?: string;
  name?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  options?: Array<{
    label: string;
    value: string;
    disabled?: boolean;
  }>;
}

/**
 * Slider 컴포넌트 타입
 */
export interface SliderProps extends BaseComponentProps {
  value?: number | number[];
  defaultValue?: number | number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  range?: boolean;
  marks?: Record<number, ReactNode>;
  tooltip?: boolean;
  onChange?: (value: number | number[]) => void;
  onAfterChange?: (value: number | number[]) => void;
}

/**
 * DatePicker 컴포넌트 타입
 */
export interface DatePickerProps extends BaseComponentProps {
  value?: Date;
  defaultValue?: Date;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  format?: string;
  showTime?: boolean;
  showToday?: boolean;
  disabledDate?: (date: Date) => boolean;
  onChange?: (date: Date | null) => void;
  onOpenChange?: (open: boolean) => void;
}

/**
 * 이벤트 핸들러 타입
 */
export type MouseEventHandler<T = HTMLElement> = (event: MouseEvent<T>) => void;
export type KeyboardEventHandler<T = HTMLElement> = (event: KeyboardEvent<T>) => void;
export type ChangeEventHandler<T = HTMLInputElement> = (event: ChangeEvent<T>) => void;
export type FormEventHandler<T = HTMLFormElement> = (event: FormEvent<T>) => void;

/**
 * 제네릭 컴포넌트 Props
 */
export interface GenericComponentProps<T = unknown> extends BaseComponentProps {
  data?: T;
  loading?: boolean;
  error?: string;
  onDataChange?: (data: T) => void;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

/**
 * 반응형 관련 타입
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface ResponsiveValue<T> {
  base?: T;
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}

/**
 * 애니메이션 관련 타입
 */
export type AnimationType = 'fade' | 'slide' | 'scale' | 'bounce' | 'none';

export interface AnimationProps {
  animation?: AnimationType;
  duration?: number;
  delay?: number;
  easing?: string;
}

/**
 * 테마 관련 타입
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  light: string;
  dark: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  breakpoints: Record<Breakpoint, string>;
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

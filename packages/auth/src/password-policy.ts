import { z } from 'zod'

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/`~]/
const UPPER_REGEX = /[A-Z]/
const LOWER_REGEX = /[a-z]/
const DIGIT_REGEX = /[0-9]/
const REPEAT_CHAR_REGEX = /(.)\1{3,}/

export type PasswordValidationContext = {
  email?: string | null
  name?: string | null
}

export type PasswordValidationIssue =
  | 'minLength'
  | 'maxLength'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'specialChar'
  | 'sameAsEmail'
  | 'repeatedChars'
  | 'sameAsCurrent'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export function validatePassword(
  password: string,
  context: PasswordValidationContext = {},
): PasswordValidationIssue[] {
  const issues: PasswordValidationIssue[] = []

  if (password.length < PASSWORD_MIN_LENGTH) issues.push('minLength')
  if (password.length > PASSWORD_MAX_LENGTH) issues.push('maxLength')
  if (!UPPER_REGEX.test(password)) issues.push('uppercase')
  if (!LOWER_REGEX.test(password)) issues.push('lowercase')
  if (!DIGIT_REGEX.test(password)) issues.push('number')
  if (!SPECIAL_CHAR_REGEX.test(password)) issues.push('specialChar')
  if (REPEAT_CHAR_REGEX.test(password)) issues.push('repeatedChars')

  const emailLocal = context.email?.split('@')[0]?.trim().toLowerCase()
  if (emailLocal && emailLocal.length > 0 && password.toLowerCase() === emailLocal) {
    issues.push('sameAsEmail')
  }

  return issues
}

export function passwordPolicyMessage(issue: PasswordValidationIssue): string {
  const messages: Record<PasswordValidationIssue, string> = {
    minLength: `密码至少 ${PASSWORD_MIN_LENGTH} 位`,
    maxLength: `密码不能超过 ${PASSWORD_MAX_LENGTH} 位`,
    uppercase: '密码须包含至少一个大写字母',
    lowercase: '密码须包含至少一个小写字母',
    number: '密码须包含至少一个数字',
    specialChar: '密码须包含至少一个特殊字符',
    sameAsEmail: '密码不能与邮箱用户名相同',
    repeatedChars: '密码不能包含 4 个及以上连续相同字符',
    sameAsCurrent: '新密码不能与当前密码相同',
  }
  return messages[issue]
}

export function assertPasswordPolicy(
  password: string,
  context: PasswordValidationContext = {},
): void {
  const issues = validatePassword(password, context)
  if (issues.length > 0) {
    throw new Error(passwordPolicyMessage(issues[0]!))
  }
}

export function createPasswordPolicySchema(context?: PasswordValidationContext) {
  return z
    .string()
    .min(PASSWORD_MIN_LENGTH, passwordPolicyMessage('minLength'))
    .max(PASSWORD_MAX_LENGTH, passwordPolicyMessage('maxLength'))
    .superRefine((value, ctx) => {
      for (const issue of validatePassword(value, context)) {
        ctx.addIssue({ code: 'custom', message: passwordPolicyMessage(issue) })
      }
    })
}

export const passwordPolicySchema = createPasswordPolicySchema()

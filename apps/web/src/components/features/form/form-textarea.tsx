import { Textarea } from '@workspace/ui/components/textarea'
import { FormBase, FormControlFunc } from './base'

export const FormTextarea: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Textarea {...field} />}</FormBase>
}

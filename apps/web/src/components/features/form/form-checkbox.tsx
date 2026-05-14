import { Checkbox } from "@workspace/ui/components/checkbox";
import { FormBase, FormControlFunc } from "./base";

export const FormCheckbox: FormControlFunc = (props) => {
  return (
    <FormBase {...props} horizontal controlFirst>
      {({ onChange, value, ...field }) => (
        <Checkbox
          {...field}
          disabled={props.disabled}
          checked={value}
          onCheckedChange={onChange}
        />
      )}
    </FormBase>
  );
};

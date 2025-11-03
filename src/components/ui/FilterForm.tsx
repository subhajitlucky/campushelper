import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterField {
  name: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: FilterOption[];
}

interface FilterFormProps {
  title: string;
  description?: string;
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  className?: string;
}

/**
 * FilterForm Component
 *
 * Reusable filter form with configurable fields.
 * Supports text inputs and select dropdowns.
 */
export default function FilterForm({
  title,
  description,
  fields,
  values,
  onChange,
  onApply,
  onClear,
  className = ''
}: FilterFormProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              {field.type === 'text' ? (
                <input
                  type="text"
                  value={values[field.name] || ''}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  placeholder={field.placeholder || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <select
                  value={values[field.name] || ''}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All {field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-2 items-end">
            <Button onClick={onApply} className="flex-1">
              Apply Filters
            </Button>
            <Button variant="outline" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

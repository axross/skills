# Verification

Apply these guidelines to confirm that any change produces the correct application output before considering the task done.

## Identifying Affected Output Surfaces

Use this table to determine which output surfaces a change puts at risk. Keep the "Changed area" entries current with the library's actual file layout as it grows.

| Changed area                                                    | Output surface at risk            |
| --------------------------------------------------------------- | --------------------------------- |
| Page/view files and the components they render                  | Rendered pages/views              |
| Data-access functions or data-fetching logic                    | Rendered output, content fidelity |
| Route/navigation definitions and error/not-found handlers       | Routing and navigation            |
| Metadata generation, sitemap, robots, and social-preview assets | Metadata and discoverability      |
| Content-processing pipeline (if any)                            | Content fidelity                  |

- Changes that touch none of the above — type definitions or utilities with no UI call path — do not put any output surface at risk.

**Guidelines:**

- MUST map changed files to their at-risk output surfaces before choosing the verification path.

## Manual Verification

Manual verification is the first line of confirmation.

**Guidelines:**

- MUST start the development server (`npm run check`) and navigate to the affected route/view after every change that touches an output surface.
- MUST verify the not-found / error state renders when the change affects routing or error handling (e.g., navigate to a non-existent record).

# Reading the unmatched-language decision

The task asks what a visitor sees when their browser requests no matching
translation. The stopping answer has two parts. Show the post's default
translation. If it is missing, the post returns the not-found page even if a
different translation exists.

[The scenario patch](../patch.diff) supplies the starting manual.
[One possible edit](./example.patch) applies to the materialized starting
workspace. Only the scenario patch and the task prompt reach the actor.
Judge other edits by following their labels and reading the landing text.

| Start                                            | Before the edit                                                                                                                                                                                      | After the example edit                                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published manual, `docs/index.md`                | The unmatched-language question opens `reading/translation.md#available-locales`. It explains who supplies translations. The reader would have to search beyond the linked section for the fallback. | The question opens `reading/translation.md#unmatched-preferences`. Stop there with the default translation and the missing-default exception.                                                        |
| Subject, `docs/reading/index.md`                 | Its only link opens `addresses.md`, which answers a URL question. The language route is missing even though the root links to the language page.                                                     | Choose the translation question over the address question. It opens `translation.md#unmatched-preferences` with both outcomes.                                                                       |
| Contributor README, “check what the reader sees” | `README.md` → `docs/deployment.md#locale-fallback` → `docs/reading/translation.md#unmatched-preferences`. The answer and its exception are already correct.                                          | `README.md` → `docs/reading/translation.md#unmatched-preferences`. The reader gets both outcomes and skips the deployment guide.                                                                     |
| Editorial term, `AGENTS.md`                      | The staff-guide link opens `docs/staff-handbook.md#house-language`, then the link for the unmatched request opens the language decision.                                                             | The terms link opens `reading/translation.md#editorial-terms` inside the manual. A locale and its translation are distinct. Its in-page link leads to the same decision the README reached directly. |
| Old deployment bookmark                          | `docs/deployment.md#locale-fallback` links to the unmatched-language decision. Published usage is unknown.                                                                                           | The entry still links to the decision. Only the staff handbook was approved for removal.                                                                                                             |

For each of the first two rows and the old deployment bookmark, follow the
links in a copy containing only `docs/`. The contributor README and agent
instructions are checkout entry points. The editorial terms can also be found
through the exported root.

The production row in the old deployment table also claimed that the default
locale came first. The worked edit keeps the operational fact about the build
in that row. The reading subject owns the selection order.

## Controls for the editorial judgment

Apply each variation separately to the example edit. Each keeps the pages
reachable and its Markdown fragments resolvable, so the whole-root checker
can pass all four. Inspect the actual reader task to distinguish them.

| Variation                                                         | Evidence that fails the reader task                                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Change the root question’s fragment back to `#available-locales`. | Stop at the named heading. It gives the source of available translations and never answers the caller's question.           |
| Remove the translation link from the reading index only.          | Start at the reading index. There is no route for this question, despite the working root shortcut.                         |
| Restore the README’s `docs/deployment.md#locale-fallback` link.   | The reader reaches the right answer and exception, but has to open the unrelated deployment overview again.                 |
| Remove the missing-default sentence from the answer.              | A direct route now leaves the reader unable to predict the result when another translation exists but the default does not. |

The controlled-caller script factor rejects the starting agent instructions
and accepts the example edit. It checks one retired reference. The reasoning
factors judge where the replacement leads and what the reader learns there.
These fixtures provide review examples and do not measure model performance.

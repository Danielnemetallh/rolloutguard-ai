export type WorkbookSlot = 'contract' | 'schedule' | 'status'

export type WorkbookImportFiles = {
  contract: File
  schedule: File
  status: File
}

export const WORKBOOK_SLOT_ORDER: WorkbookSlot[] = ['contract', 'schedule', 'status']

export const WORKBOOK_SLOT_LABELS: Record<WorkbookSlot, string> = {
  contract: 'Vertrag',
  schedule: 'Terminplan',
  status: 'Standortstatus',
}

export function workbookExtension(file: File): 'xlsx' | 'csv' | 'other' {
  const name = file.name.toLowerCase().trim()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return 'xlsx'
  if (name.endsWith('.csv')) return 'csv'
  return 'other'
}

export function isWorkbookFile(file: File): boolean {
  const name = file.name.toLowerCase().trim()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return true
  const mime = file.type.toLowerCase()
  return (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  )
}

export function isDocumentCorpusFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.md')
}

export function guessWorkbookSlot(filename: string): WorkbookSlot | null {
  const name = filename.toLowerCase()
  if (/contract|obligation|vertrag|kaggle_contract/.test(name)) return 'contract'
  if (/schedule|partner|termin|kaggle_partner/.test(name)) return 'schedule'
  if (/status|standort|kaggle_site/.test(name)) return 'status'
  if (/site_project|project_status/.test(name)) return 'status'
  return null
}

export function isWorkbookImportReady(
  workbooks: Partial<WorkbookImportFiles>,
): workbooks is WorkbookImportFiles {
  return Boolean(workbooks.contract && workbooks.schedule && workbooks.status)
}

/** Merge new files into existing slots without overwriting filled slots. */
export function assignWorkbookSlots(
  files: File[],
  existing: Partial<WorkbookImportFiles> = {},
): Partial<WorkbookImportFiles> {
  const result: Partial<WorkbookImportFiles> = { ...existing }
  const unassigned: File[] = []

  for (const file of files) {
    if (!isWorkbookFile(file)) continue

    const alreadyUsed = WORKBOOK_SLOT_ORDER.some((slot) => result[slot] === file)
    if (alreadyUsed) continue

    const slot = guessWorkbookSlot(file.name)
    if (slot) {
      result[slot] = file
      continue
    }

    unassigned.push(file)
  }

  for (const file of unassigned) {
    const next = WORKBOOK_SLOT_ORDER.find((slot) => !result[slot])
    if (next) result[next] = file
  }

  return result
}

import { describe, expect, it } from 'vitest'
import {
  assignWorkbookSlots,
  guessWorkbookSlot,
  isWorkbookImportReady,
} from '@/lib/workbookImport'

function file(name: string) {
  return new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('workbookImport', () => {
  it('maps kaggle fixture filenames to the three slots', () => {
    expect(guessWorkbookSlot('kaggle_contract_obligations.xlsx')).toBe('contract')
    expect(guessWorkbookSlot('kaggle_partner_schedule.xlsx')).toBe('schedule')
    expect(guessWorkbookSlot('kaggle_site_project_status.xlsx')).toBe('status')
  })

  it('assigns three dropped workbooks by filename', () => {
    const assigned = assignWorkbookSlots([
      file('kaggle_partner_schedule.xlsx'),
      file('kaggle_contract_obligations.xlsx'),
      file('kaggle_site_project_status.xlsx'),
    ])
    expect(assigned.contract?.name).toBe('kaggle_contract_obligations.xlsx')
    expect(assigned.schedule?.name).toBe('kaggle_partner_schedule.xlsx')
    expect(assigned.status?.name).toBe('kaggle_site_project_status.xlsx')
  })

  it('adds workbooks one at a time without overwriting earlier slots', () => {
    let slots: ReturnType<typeof assignWorkbookSlots> = {}
    slots = assignWorkbookSlots([file('kaggle_contract_obligations.xlsx')], slots)
    expect(slots.contract?.name).toBe('kaggle_contract_obligations.xlsx')
    expect(slots.schedule).toBeUndefined()

    slots = assignWorkbookSlots([file('kaggle_partner_schedule.xlsx')], slots)
    expect(slots.contract?.name).toBe('kaggle_contract_obligations.xlsx')
    expect(slots.schedule?.name).toBe('kaggle_partner_schedule.xlsx')

    slots = assignWorkbookSlots([file('kaggle_site_project_status.xlsx')], slots)
    expect(isWorkbookImportReady(slots)).toBe(true)
  })

  it('fills unnamed workbooks into the next free slot in order', () => {
    let slots: ReturnType<typeof assignWorkbookSlots> = {}
    slots = assignWorkbookSlots([file('a.xlsx')], slots)
    slots = assignWorkbookSlots([file('b.xlsx')], slots)
    slots = assignWorkbookSlots([file('c.xlsx')], slots)
    expect(isWorkbookImportReady(slots)).toBe(true)
    expect(slots.contract?.name).toBe('a.xlsx')
    expect(slots.schedule?.name).toBe('b.xlsx')
    expect(slots.status?.name).toBe('c.xlsx')
  })

  it('replaces an already filled slot when the same kind is selected again', () => {
    let slots = assignWorkbookSlots([file('kaggle_contract_obligations.xlsx')])
    slots = assignWorkbookSlots([file('vertrag_neu.xlsx')], slots)
    expect(slots.contract?.name).toBe('vertrag_neu.xlsx')
    expect(slots.schedule).toBeUndefined()
  })
})

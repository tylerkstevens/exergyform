'use client'

import { QuestionConfig, BranchRule, BranchOperator } from '@/lib/database.types'
import {
  getConditionableQuestions,
  getBranchableQuestions,
  getQuestionValues,
  createBranchRule,
} from '@/lib/branching'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, GitBranch, ArrowRight } from 'lucide-react'

interface BranchEditorProps {
  question: QuestionConfig
  allQuestions: QuestionConfig[]
  onUpdate: (updates: Partial<QuestionConfig>) => void
}

const OPERATORS: { value: BranchOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is one of' },
]

export function BranchEditor({ question, allQuestions, onUpdate }: BranchEditorProps) {
  const conditionableQuestions = getConditionableQuestions(question, allQuestions)
  const branchableQuestions = getBranchableQuestions(question, allQuestions)
  const branches = question.branches || []

  // Can't set up branching if there are no questions to branch from or to
  const canBranch = conditionableQuestions.length > 0 && branchableQuestions.length > 0

  const addBranch = () => {
    if (conditionableQuestions.length === 0) return

    const firstConditionQuestion = conditionableQuestions[0]
    const possibleValues = getQuestionValues(firstConditionQuestion)

    const newBranch = createBranchRule(
      firstConditionQuestion.id,
      'equals',
      possibleValues[0] || '',
      branchableQuestions[0]?.id || null
    )

    onUpdate({
      branches: [...branches, newBranch],
    })
  }

  const updateBranch = (index: number, updates: Partial<BranchRule>) => {
    const newBranches = [...branches]
    newBranches[index] = { ...newBranches[index], ...updates }

    // If condition questionId changed, reset the value
    if (updates.condition?.questionId && updates.condition.questionId !== branches[index].condition.questionId) {
      const newQuestion = allQuestions.find(q => q.id === updates.condition!.questionId)
      const possibleValues = newQuestion ? getQuestionValues(newQuestion) : []
      newBranches[index] = {
        ...newBranches[index],
        condition: {
          ...newBranches[index].condition,
          ...updates.condition,
          value: possibleValues[0] || '',
        },
      }
    }

    onUpdate({ branches: newBranches })
  }

  const deleteBranch = (index: number) => {
    onUpdate({
      branches: branches.filter((_, i) => i !== index),
    })
  }

  const updateDefaultNext = (nextId: string | null) => {
    onUpdate({ defaultNextId: nextId })
  }

  // Get question title truncated
  const getQuestionTitle = (q: QuestionConfig) => {
    const title = q.title || 'Untitled'
    return title.length > 30 ? title.substring(0, 30) + '...' : title
  }

  if (!canBranch) {
    return (
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2 text-slate-500">
          <GitBranch className="w-4 h-4" />
          <span className="text-sm">
            {conditionableQuestions.length === 0
              ? 'Add dropdown, yes/no, or multiple choice questions before this one to enable branching.'
              : 'Add more questions after this one to enable branching.'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-600" />
          <Label className="text-sm font-medium">Branching Logic</Label>
        </div>
        <Button variant="outline" size="sm" onClick={addBranch}>
          <Plus className="w-4 h-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {branches.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">
          No branching rules. Questions will follow in order.
        </p>
      ) : (
        <div className="space-y-3">
          {branches.map((branch, index) => {
            const conditionQuestion = allQuestions.find(
              q => q.id === branch.condition.questionId
            )
            const possibleValues = conditionQuestion
              ? getQuestionValues(conditionQuestion)
              : []

            return (
              <div
                key={branch.id}
                className="p-3 rounded-lg border border-slate-200 bg-white space-y-3"
              >
                {/* Condition row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-600">IF</span>

                  {/* Question selector */}
                  <Select
                    value={branch.condition.questionId}
                    onValueChange={(value) =>
                      updateBranch(index, {
                        condition: { ...branch.condition, questionId: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue placeholder="Select question" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionableQuestions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {getQuestionTitle(q)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator selector */}
                  <Select
                    value={branch.condition.operator}
                    onValueChange={(value) =>
                      updateBranch(index, {
                        condition: {
                          ...branch.condition,
                          operator: value as BranchOperator,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value selector */}
                  <Select
                    value={String(branch.condition.value)}
                    onValueChange={(value) =>
                      updateBranch(index, {
                        condition: { ...branch.condition, value },
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px] h-8 text-sm">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {possibleValues.map((val) => (
                        <SelectItem key={val} value={val}>
                          {val}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">THEN</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />

                  {/* Next question selector */}
                  <Select
                    value={branch.nextQuestionId || '_end'}
                    onValueChange={(value) =>
                      updateBranch(index, {
                        nextQuestionId: value === '_end' ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder="Select next question" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchableQuestions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          Go to: {getQuestionTitle(q)}
                        </SelectItem>
                      ))}
                      <SelectItem value="_end">End form</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBranch(index)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Default next (fallback) */}
      {branches.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Otherwise:</span>
            <Select
              value={question.defaultNextId === null ? '_end' : question.defaultNextId || '_continue'}
              onValueChange={(value) => {
                if (value === '_continue') {
                  onUpdate({ defaultNextId: undefined })
                } else if (value === '_end') {
                  onUpdate({ defaultNextId: null })
                } else {
                  onUpdate({ defaultNextId: value })
                }
              }}
            >
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_continue">Continue to next question</SelectItem>
                {branchableQuestions.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    Go to: {getQuestionTitle(q)}
                  </SelectItem>
                ))}
                <SelectItem value="_end">End form</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

import { QuestionConfig, BranchRule, BranchOperator, Json } from './database.types'

/**
 * Evaluate a single branch condition against the current answers
 */
export function evaluateCondition(
  condition: BranchRule['condition'],
  answers: Record<string, Json>
): boolean {
  const answer = answers[condition.questionId]

  // Handle null/undefined answers
  if (answer === null || answer === undefined) {
    return false
  }

  const answerStr = String(answer)
  const conditionValue = condition.value

  switch (condition.operator) {
    case 'equals':
      if (Array.isArray(answer)) {
        // For checkbox-type questions, check if the value is in the array
        return answer.includes(conditionValue as string)
      }
      return answerStr === String(conditionValue)

    case 'not_equals':
      if (Array.isArray(answer)) {
        return !answer.includes(conditionValue as string)
      }
      return answerStr !== String(conditionValue)

    case 'contains':
      if (Array.isArray(answer)) {
        return answer.some(a => String(a).toLowerCase().includes(String(conditionValue).toLowerCase()))
      }
      return answerStr.toLowerCase().includes(String(conditionValue).toLowerCase())

    case 'in':
      if (!Array.isArray(conditionValue)) return false
      if (Array.isArray(answer)) {
        // Check if any of the selected values are in the condition values
        return answer.some(a => conditionValue.includes(String(a)))
      }
      return conditionValue.includes(answerStr)

    default:
      return false
  }
}

/**
 * Get the next question ID based on branching rules
 * Returns null if the form should end, or the question ID to go to
 */
export function getNextQuestionId(
  currentQuestion: QuestionConfig,
  allQuestions: QuestionConfig[],
  answers: Record<string, Json>
): string | null {
  // Check branch rules in order
  if (currentQuestion.branches && currentQuestion.branches.length > 0) {
    for (const branch of currentQuestion.branches) {
      if (evaluateCondition(branch.condition, answers)) {
        return branch.nextQuestionId
      }
    }
  }

  // Use default next if specified
  if (currentQuestion.defaultNextId !== undefined) {
    return currentQuestion.defaultNextId
  }

  // Linear fallback: go to next question in array
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestion.id)
  if (currentIndex >= 0 && currentIndex < allQuestions.length - 1) {
    return allQuestions[currentIndex + 1].id
  }

  // End of form
  return null
}

/**
 * Calculate the expected question path based on current answers
 * This is used for progress bar calculation
 */
export function getQuestionPath(
  questions: QuestionConfig[],
  answers: Record<string, Json>,
  startFromId?: string
): QuestionConfig[] {
  if (questions.length === 0) return []

  const path: QuestionConfig[] = []
  const visited = new Set<string>()

  // Start from first question or specified start
  let currentId: string | null = startFromId || questions[0].id

  // Limit iterations to prevent infinite loops
  const maxIterations = questions.length * 2
  let iterations = 0

  while (currentId && iterations < maxIterations) {
    iterations++

    // Prevent infinite loops from circular references
    if (visited.has(currentId)) break
    visited.add(currentId)

    const question = questions.find(q => q.id === currentId)
    if (!question) break

    path.push(question)
    currentId = getNextQuestionId(question, questions, answers)
  }

  return path
}

/**
 * Check if a question has any branching configured
 */
export function hasBranching(question: QuestionConfig): boolean {
  return (question.branches && question.branches.length > 0) ||
         question.defaultNextId !== undefined
}

/**
 * Get questions that can be branched to (all questions that come after the current one)
 */
export function getBranchableQuestions(
  currentQuestion: QuestionConfig,
  allQuestions: QuestionConfig[]
): QuestionConfig[] {
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestion.id)
  if (currentIndex < 0) return []

  // Return all questions after the current one
  return allQuestions.slice(currentIndex + 1)
}

/**
 * Get questions whose answers can be used for branching (questions before the current one)
 */
export function getConditionableQuestions(
  currentQuestion: QuestionConfig,
  allQuestions: QuestionConfig[]
): QuestionConfig[] {
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestion.id)
  if (currentIndex <= 0) return []

  // Only questions before the current one, and only certain types that make sense for branching
  const branchableTypes = ['dropdown', 'checkboxes', 'yes_no', 'rating', 'opinion_scale']

  return allQuestions
    .slice(0, currentIndex)
    .filter(q => branchableTypes.includes(q.type))
}

/**
 * Get the possible values for a question (for use in branch conditions)
 */
export function getQuestionValues(question: QuestionConfig): string[] {
  switch (question.type) {
    case 'dropdown':
    case 'checkboxes':
      return question.options || []

    case 'yes_no':
      return ['Yes', 'No']

    case 'rating':
      const minRating = question.minValue || 1
      const maxRating = question.maxValue || 5
      return Array.from(
        { length: maxRating - minRating + 1 },
        (_, i) => String(minRating + i)
      )

    case 'opinion_scale':
      const minScale = question.minValue || 1
      const maxScale = question.maxValue || 10
      return Array.from(
        { length: maxScale - minScale + 1 },
        (_, i) => String(minScale + i)
      )

    default:
      return []
  }
}

/**
 * Create a new branch rule with defaults
 */
export function createBranchRule(
  questionId: string,
  operator: BranchOperator = 'equals',
  value: string = '',
  nextQuestionId: string | null = null
): BranchRule {
  return {
    id: crypto.randomUUID(),
    condition: {
      questionId,
      operator,
      value,
    },
    nextQuestionId,
  }
}

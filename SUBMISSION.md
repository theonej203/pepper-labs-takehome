# Submission

**Candidate name:** _Your name_
**Date:** _Date_
**Time spent:** _Approximate hours_

---

## Completed Tasks

Check off what you finished:

- [ ] Task 1 — Create Product
- [ ] Task 2 — Update Variant
- [ ] Task 3 — Fix soft-delete bug
- [ ] Task 4 — Loading & error states
- [ ] Task 5 — Input validation

---

## Approach & Decisions

_Briefly describe the approach you took for each task. Mention any trade-offs you made or alternative approaches you considered._

### Task 1
Nothing much going on for this tasks, the task description is straight forward to me with not much variations. Though I did kept the price unit as cent for simpler implementation and don't have to worry about floating point number for the front end.

I did also done some imput validations as well.

### Task 2
This is also a straight forward task, of getting the product variants from the database and modifying the data. I did consider a small problem of two clients trying to update the same info and if updating one info should change the other. I decided on just implementing a simple PUT approach where the other client need to refresh.

Also did some input validation

### Task 3

Deleted some entries to see the non-null `deleted_at` column. I just added a condition for the query to omit all those entries. There might be a future use case where we do want to see the deleted products.

used the code \backend\src\routes\products.ts:61-65 to see the problem clearly

### Task 4

Added 2 components frontend\src\components\ErrorState.tsx and frontend\src\components\LoadingState.tsx. Separating the state components from the main page felt like a better idea as we can reuse the component for the Categories as well.

### Task 5

Nothing much is needed for Task 5, since I've added the checks as I was developing. I did found a mismatch between required fields for TASK1 which was fixed.

---

## What I'd improve with more time

_What would you add, refactor, or fix if you had another couple of hours?_

---

## Anything else?

_Optional — anything you want the reviewer to know (e.g. bugs you noticed, improvements you'd suggest to the existing code, etc.)._

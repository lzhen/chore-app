# NestMe GTM success metrics

## Product promise
Help households share routine work with less reminding, less ambiguity, and a fairer sense of ownership.

## North-star outcome
**Weekly households that complete shared chores with at least two active members and no unresolved overdue chore older than 7 days.**

## Activation
A new household is activated when, within 24 hours of signup, it:
1. adds or confirms at least 2 household members;
2. creates at least 3 chores;
3. assigns at least 2 chores to different people; and
4. records at least 1 completion.

Target: **>= 60% activation** among verified signups.

## Engagement and retention
- D1 household return: >= 45%
- W1 household return: >= 35%
- W4 household return: >= 25%
- Weekly active households with 2+ active members: >= 55%
- Chores completed / chores due: >= 75%
- Households with overdue chores older than 7 days: <= 15%

## Experience quality
- Crash-free sessions: >= 99.8%
- Successful chore-create actions: >= 99.5%
- Successful completion actions: >= 99.7%
- p75 primary screen interaction latency: <= 200 ms where locally measurable
- Support requests caused by login/reset confusion: < 3% of weekly active households
- Accessibility: no critical WCAG 2.2 AA violations in release QA

## Household fairness
Do not optimize for a leaderboard. Track:
- distribution of assigned workload across active members;
- percentage of households where one member carries >70% of assigned estimated minutes;
- reassignment rate after availability changes;
- overdue tasks by assignee without exposing comparative ranking as the primary experience.

Target: < 20% of active households with one member carrying >70% of weekly assigned workload unless explicitly configured.

## Commercial validation
Before broad paid acquisition:
- >= 20 target households complete a 2-week pilot;
- >= 40% say they would be disappointed if NestMe disappeared;
- >= 30% indicate willingness to pay for the proposed premium tier or family plan;
- at least 5 verbatim user stories confirm reduced reminding / coordination friction.

## App Store quality target
Target public rating: **4.7+**, measured only after a minimum meaningful review base.

Release gates intended to maximize the probability of 4.7+:
- no known P0/P1 defects;
- crash-free sessions >= 99.8%;
- onboarding activation funnel is instrumented;
- password reset and account recovery verified on real iOS devices;
- offline/poor-network failure states are understandable and recoverable;
- review prompt is never shown before the user has completed a meaningful success action;
- support contact is visible and support issues are triaged within one business day during launch;
- do not gate core usability behind a rating prompt.

The 4.7+ rating is a product quality objective, not a guaranteed outcome; actual ratings are determined by users.

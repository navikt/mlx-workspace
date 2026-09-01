# Quarantined: runs from two overlapping queues

Two benchmark queues ran at the same time on 2 September, 00:27–00:53. They share one machine
and one port, and each one's `server-stop` kills the other's server mid-task. The victim then
records "no changes made" in seconds, which reads exactly like a weak model.

Nothing here is a measurement of any model. The files are kept rather than deleted so the shape
stays visible: a run that scores near zero with fast, empty tasks is usually the harness, and
this directory is what that looks like.

It has now happened twice — three queues at 00:56 on 1 September, and this pair — the second
time within an hour of a review that warned about exactly it. `bench-models` now takes an
atomic `mkdir` lock and refuses to start beside a live queue, so a third occurrence needs the
lock to be removed on purpose.

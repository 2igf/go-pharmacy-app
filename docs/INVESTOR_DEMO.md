# Investor demonstration — fictional simulation only

Prepare a dedicated empty demo database, apply migrations, and run the safe fictional catalog seed. Provision an operator account with admin:create and invite one customer using invite:create; privately supply that customer's code. No credentials are embedded in the application or this document.

1. Open `/login`, choose account creation, enter the invited email, its code, a fictional name and a strong unique test password. Confirm that an uninvited email or wrong code fails.
2. Browse `/products`. Search for `DEMO`, filter skincare and inspect `DEMO غسول تجريبي` priced at 4.25 JD.
3. Add two units. Review `/cart`: 8.50 JD, zero simulated shipping/tax. Quantity changes and removal update the server quotation.
4. In `/profile`, save a fictional address and contact name/number. Never use a real patient address or history.
5. Open `/checkout`, choose the test address, enter fictional contact fields and acknowledge the simulation. Submit once.
6. The order confirmation uses `/order/<id>`, shows a SIM-prefixed order number and the persisted 8.50 JD total. Reload and show the same order in account history.
7. Sign out and sign in as the operator. Open `/admin`, review the customer's order and inventory. Advance pending → confirmed → processing → shipped → delivered, or demonstrate cancellation before shipped.
8. Sign back into the customer account and show the updated status (tracking polls every five seconds).
9. Demonstrate that the prescription product cannot enter checkout and the out-of-stock item cannot be added. Medical routes are explicitly unavailable.
10. Explain that status changes, catalog/inventory and persistence are operational software; every purchase/payment/delivery is simulated. No sales, adoption, revenue, reviews or traction metrics are claimed.

For a cancellation demonstration inventory is restored once, even when the same action is retried. For a delivered order inventory remains consumed in the simulation. A failed transaction restores stock and retains the cart automatically. Existing committed idempotency keys always return their original order.

Final live demonstration verification and any missing infrastructure are stated in IMPLEMENTATION_REPORT.md.

---
title: FAQ Section
category: Product
icon: faq
summary: Answer common questions right on the product page and remove purchase hesitation.
order: 6
features:
  - Create and manage FAQs for each product
  - Add the same FAQs to all products at once
  - Collapsible accordion for clean navigation
  - No coding required
  - Lightweight and compatible with most themes
---

Frequently asked questions belong where customers are deciding. The FAQ addon lets you create and display a clean,
collapsible FAQ section on any product page, so shoppers find answers in seconds instead of contacting support.

Add unlimited questions per product, or apply a common set of FAQs across all products at once. Answering objections up
front builds trust, reduces pre-sale questions, and keeps buyers moving toward checkout, all without slowing down your
site.

## Developer hooks

### Filters

- **`jetexir_product_faq_items`** — `apply_filters( 'jetexir_product_faq_items', $faqs, $product_id )` — Filter the FAQ
  items list rendered in the product tab.
- **`jetexir_product_faq_tab_title`** — `apply_filters( 'jetexir_product_faq_tab_title', $title, $product_id )` — Filter
  the FAQ tab title.
- **`jetexir_product_faq_tab_priority`** — `apply_filters( 'jetexir_product_faq_tab_priority', 50, $product_id )` —
  Filter the FAQ tab priority on the product page.

---
title: Fly Cart
category: Cart
icon: fly-cart
summary: A fast, elegant slide-in cart that keeps customers shopping without leaving the page.
order: 10
features:
  - Works with both AJAX and standard Add to Cart buttons
  - Slide-out cart with an instant summary
  - Choose your own fly cart icon and position
  - Show or hide the fly cart per page (home, blog, posts, cart, checkout, product)
  - Go to checkout in one click
---

Reduce abandonment with a shopping experience that never interrupts the customer. Fly Cart slides in instantly whenever
a product is added to the cart, with both AJAX and standard Add to Cart buttons, showing the full summary and a direct
path to checkout.

Match it to your store by choosing the cart icon and position, and decide exactly where it appears: home, blog, posts,
cart, checkout, or product pages. Shoppers keep browsing without friction and return to their cart whenever they're
ready.

## Developer hooks

### Filters

- **`jetexir_fly_cart_hide`** — `apply_filters( 'jetexir_fly_cart_hide', $hide )` — Return `true` to hide the Fly Cart
  (icon and modal) on the current page.
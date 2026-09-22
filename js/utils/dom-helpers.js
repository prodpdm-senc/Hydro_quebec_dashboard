function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k.startsWith('on')) {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.className = v;
    } else if (k === 'style') {
      if (typeof v === 'string') el.setAttribute('style', v);
      else Object.assign(el.style, v);
    } else {
      el.setAttribute(k, v);
    }
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Element) {
      el.appendChild(child);
    }
  });
  return el;
}

function setHTML(el, html) {
  el.innerHTML = html;
}

function addClass(el, ...classes) {
  el.classList.add(...classes);
  return el;
}

function removeClass(el, ...classes) {
  el.classList.remove(...classes);
  return el;
}

function query(selector, parent = document) {
  return parent.querySelector(selector);
}

function queryAll(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function on(el, event, handler) {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

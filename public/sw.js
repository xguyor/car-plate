// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json()

    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data,
      actions: [
        { action: 'open', title: 'Open App' }
      ]
    }

    event.waitUntil(
      Promise.all([
        self.registration.showNotification(data.title, options),
        // Notify all open clients to refresh their data
        clients.matchAll({ type: 'window' }).then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({ type: 'ALERT_UPDATE', data: data })
          })
        })
      ])
    )
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/camera'

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

self.addEventListener('install', function(event) {
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim())
})

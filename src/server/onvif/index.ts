export {
  discoverCameras,
  connectToCamera,
  getSnapshotUri,
  subscribeToEvents,
} from "@/server/onvif/service"
export type {
  ConnectedCamera,
  DiscoveredCamera,
  EventSubscription,
  OnvifNotification,
} from "@/server/onvif/service"
export { OnvifError, mapOnvifError } from "@/server/onvif/errors"
export type { OnvifErrorCode } from "@/server/onvif/errors"

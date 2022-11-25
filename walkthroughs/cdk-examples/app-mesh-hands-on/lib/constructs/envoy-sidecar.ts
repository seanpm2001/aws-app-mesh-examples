import * as ecs from "aws-cdk-lib/aws-ecs";
import { Duration } from "aws-cdk-lib";
import { MeshStack } from "../stacks/mesh-components";
import { EnvoyContainerProps } from "../utils";
import { Construct } from "constructs";

export class EnvoySidecar extends Construct {
  public readonly options: ecs.ContainerDefinitionOptions;
  constructor(mesh: MeshStack, id: string, props: EnvoyContainerProps) {
    super(mesh, id);

    this.options = {
      image: ecs.ContainerImage.fromRegistry(this.node.tryGetContext("IMAGE_ENVOY")),
      containerName: "envoy",
      logging: ecs.LogDriver.awsLogs({
        logGroup: mesh.serviceDiscovery.base.logGroup,
        streamPrefix: props.logStreamPrefix,
      }),
      environment: {
        ENVOY_LOG_LEVEL: "debug",
        ENABLE_ENVOY_XRAY_TRACING: props.enableXrayTracing ? "1" : "0",
        ENABLE_ENVOY_STATS_TAGS: "1",
        APPMESH_RESOURCE_ARN: props.appMeshResourceArn,
      },
      user: "1337",
      healthCheck: {
        retries: 10,
        interval: Duration.seconds(5),
        timeout: Duration.seconds(10),
        command: ["CMD-SHELL", "curl -s http://localhost:9901/server_info | grep state | grep -q LIVE"],
      },
      portMappings: [
        {
          containerPort: 9901,
          protocol: ecs.Protocol.TCP,
        },
        {
          containerPort: 15000,
          protocol: ecs.Protocol.TCP,
        },
        {
          containerPort: 15001,
          protocol: ecs.Protocol.TCP,
        },
      ],
    };
  }
  public static buildAppMeshProxy = (...appPorts: number[]): ecs.AppMeshProxyConfiguration => {
    return new ecs.AppMeshProxyConfiguration({
      containerName: "envoy",
      properties: {
        proxyIngressPort: 15000,
        proxyEgressPort: 15001,
        appPorts: appPorts,
        ignoredUID: 1337,
        egressIgnoredIPs: ["169.254.170.2", "169.254.169.254"],
      },
    });
  };
}

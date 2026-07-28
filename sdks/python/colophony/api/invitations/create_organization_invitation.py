from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.create_organization_invitation_body import CreateOrganizationInvitationBody
from ...models.create_organization_invitation_response_201 import CreateOrganizationInvitationResponse201
from ...types import Response


def _get_kwargs(
    org_id: UUID,
    *,
    body: CreateOrganizationInvitationBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/organizations/{org_id}/invitations".format(
            org_id=quote(str(org_id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> CreateOrganizationInvitationResponse201 | None:
    if response.status_code == 201:
        response_201 = CreateOrganizationInvitationResponse201.from_dict(response.json())

        return response_201

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[CreateOrganizationInvitationResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrganizationInvitationBody,
) -> Response[CreateOrganizationInvitationResponse201]:
    """Create an invitation

     Create and send an email invitation to join the organization. Revokes any existing pending
    invitation for the same email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (CreateOrganizationInvitationBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateOrganizationInvitationResponse201]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrganizationInvitationBody,
) -> CreateOrganizationInvitationResponse201 | None:
    """Create an invitation

     Create and send an email invitation to join the organization. Revokes any existing pending
    invitation for the same email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (CreateOrganizationInvitationBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateOrganizationInvitationResponse201
    """

    return sync_detailed(
        org_id=org_id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrganizationInvitationBody,
) -> Response[CreateOrganizationInvitationResponse201]:
    """Create an invitation

     Create and send an email invitation to join the organization. Revokes any existing pending
    invitation for the same email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (CreateOrganizationInvitationBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateOrganizationInvitationResponse201]
    """

    kwargs = _get_kwargs(
        org_id=org_id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    org_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrganizationInvitationBody,
) -> CreateOrganizationInvitationResponse201 | None:
    """Create an invitation

     Create and send an email invitation to join the organization. Revokes any existing pending
    invitation for the same email. Requires ADMIN role.

    Args:
        org_id (UUID):
        body (CreateOrganizationInvitationBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateOrganizationInvitationResponse201
    """

    return (
        await asyncio_detailed(
            org_id=org_id,
            client=client,
            body=body,
        )
    ).parsed

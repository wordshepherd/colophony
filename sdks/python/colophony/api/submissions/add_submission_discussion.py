from http import HTTPStatus
from typing import Any
from urllib.parse import quote
from uuid import UUID

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.add_submission_discussion_body import AddSubmissionDiscussionBody
from ...models.add_submission_discussion_response_200 import AddSubmissionDiscussionResponse200
from ...types import Response


def _get_kwargs(
    id: UUID,
    *,
    body: AddSubmissionDiscussionBody,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/submissions/{id}/discussions".format(
            id=quote(str(id), safe=""),
        ),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> AddSubmissionDiscussionResponse200 | None:
    if response.status_code == 200:
        response_200 = AddSubmissionDiscussionResponse200.from_dict(response.json())

        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[AddSubmissionDiscussionResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddSubmissionDiscussionBody,
) -> Response[AddSubmissionDiscussionResponse200]:
    """Add a discussion comment

     Add an internal discussion comment on a submission. Only accessible to editors, admins, and assigned
    reviewers.

    Args:
        id (UUID): Resource UUID
        body (AddSubmissionDiscussionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddSubmissionDiscussionResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddSubmissionDiscussionBody,
) -> AddSubmissionDiscussionResponse200 | None:
    """Add a discussion comment

     Add an internal discussion comment on a submission. Only accessible to editors, admins, and assigned
    reviewers.

    Args:
        id (UUID): Resource UUID
        body (AddSubmissionDiscussionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddSubmissionDiscussionResponse200
    """

    return sync_detailed(
        id=id,
        client=client,
        body=body,
    ).parsed


async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddSubmissionDiscussionBody,
) -> Response[AddSubmissionDiscussionResponse200]:
    """Add a discussion comment

     Add an internal discussion comment on a submission. Only accessible to editors, admins, and assigned
    reviewers.

    Args:
        id (UUID): Resource UUID
        body (AddSubmissionDiscussionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddSubmissionDiscussionResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
        body=body,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AddSubmissionDiscussionBody,
) -> AddSubmissionDiscussionResponse200 | None:
    """Add a discussion comment

     Add an internal discussion comment on a submission. Only accessible to editors, admins, and assigned
    reviewers.

    Args:
        id (UUID): Resource UUID
        body (AddSubmissionDiscussionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddSubmissionDiscussionResponse200
    """

    return (
        await asyncio_detailed(
            id=id,
            client=client,
            body=body,
        )
    ).parsed
